import {
  FinancialReferenceType,
  LedgerPostingType,
  Prisma,
} from "@prisma/client";

import {
  FINANCIAL_REFERENCE_COLLECTION,
  FINANCIAL_REFERENCE_INVOICE,
} from "@/lib/finance/types";
import {
  buildOpeningBalancePostingKey,
  buildOpeningBalanceReferenceId,
} from "@/lib/ledger/opening-balance";
import { buildLedgerPostingKey } from "@/lib/ledger/posting-key";

import type { LedgerReplayEventType } from "./ledger-backfill-types";

/**
 * Read queries backing historical ledger replay — PHASE_07E2.
 *
 * Gathers financial documents eligible for replay. No mutations.
 *
 * @see ADR-033
 */

const ZERO = new Prisma.Decimal(0);

/** Issued receivables that should have produced a ledger Issue posting. */
export const LEDGER_ELIGIBLE_INVOICE_STATUSES: Prisma.EnumInvoiceStatusFilter["in"] =
  ["Issued", "Paid", "Partial", "Overdue"];

/** Confirmed cash receipts that should have produced a ledger Collection posting. */
export const LEDGER_ELIGIBLE_COLLECTION_STATUSES: Prisma.EnumCollectionStatusFilter["in"] =
  ["Confirmed", "PartiallyAllocated", "Allocated"];

export type ReplayReadClient = Pick<
  Prisma.TransactionClient,
  "dealer" | "ledgerEntry" | "invoice" | "collection" | "openingBalance"
>;

/** Normalized replay event before ledger posting. */
export interface LedgerReplayEvent {
  eventType: LedgerReplayEventType;
  phase: number;
  transactionDate: Date;
  postingDate: Date;
  createdAt: Date;
  referenceType: FinancialReferenceType;
  referenceId: string;
  referenceNo: string;
  postingType: LedgerPostingType;
  postingKey: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  createdById: string | null;
  remarks: string | null;
  reversesCollectionId: string | null;
}

export async function findDealerForReplay(
  client: ReplayReadClient,
  dealerCode: string,
): Promise<{
  dealerCode: string;
  companyName: string;
  currentBalance: Prisma.Decimal;
} | null> {
  const dealer = await client.dealer.findUnique({
    where: { dealerCode },
    select: {
      dealerCode: true,
      companyName: true,
      currentBalance: true,
    },
  });
  return dealer;
}

export async function findPostedOpeningBalanceForReplay(
  client: ReplayReadClient,
  dealerCode: string,
): Promise<{
  id: string;
  amount: Prisma.Decimal;
  effectiveDate: Date;
  referenceNo: string | null;
  createdById: string;
} | null> {
  const row = await client.openingBalance.findUnique({
    where: { dealerCode },
    select: {
      id: true,
      amount: true,
      effectiveDate: true,
      referenceNo: true,
      createdById: true,
      status: true,
    },
  });

  if (!row || (row.status !== "Posted" && row.status !== "Locked")) {
    return null;
  }

  return {
    id: row.id,
    amount: row.amount,
    effectiveDate: row.effectiveDate,
    referenceNo: row.referenceNo,
    createdById: row.createdById,
  };
}

export async function findReplayInvoices(
  client: ReplayReadClient,
  dealerCode: string,
): Promise<
  Array<{
    id: string;
    invoiceNo: string;
    grandTotal: Prisma.Decimal;
    issueDate: Date;
    createdAt: Date;
  }>
> {
  return client.invoice.findMany({
    where: {
      dealerCode,
      status: { in: LEDGER_ELIGIBLE_INVOICE_STATUSES },
    },
    select: {
      id: true,
      invoiceNo: true,
      grandTotal: true,
      issueDate: true,
      createdAt: true,
    },
    orderBy: [{ issueDate: "asc" }, { createdAt: "asc" }],
  });
}

export async function findReplayCollections(
  client: ReplayReadClient,
  dealerCode: string,
): Promise<
  Array<{
    id: string;
    collectionNo: string;
    receivedAmount: Prisma.Decimal;
    collectionDate: Date;
    confirmedAt: Date | null;
    createdAt: Date;
    status: string;
    reversedAt: Date | null;
    confirmedById: string | null;
    remarks: string | null;
  }>
> {
  return client.collection.findMany({
    where: {
      dealerCode,
      OR: [
        { status: { in: LEDGER_ELIGIBLE_COLLECTION_STATUSES } },
        { status: "Reversed" },
      ],
    },
    select: {
      id: true,
      collectionNo: true,
      receivedAmount: true,
      collectionDate: true,
      confirmedAt: true,
      createdAt: true,
      status: true,
      reversedAt: true,
      confirmedById: true,
      remarks: true,
    },
    orderBy: [{ collectionDate: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Assemble replay events in strict phase order:
 *   1. Opening Balance
 *   2. Issued invoices
 *   3. Confirmed collections
 *   4. Collection reversals
 *
 * Within each phase, sort by `transactionDate`, then `createdAt`.
 */
export async function gatherReplayEvents(
  client: ReplayReadClient,
  dealerCode: string,
): Promise<LedgerReplayEvent[]> {
  const [openingBalance, invoices, collections] = await Promise.all([
    findPostedOpeningBalanceForReplay(client, dealerCode),
    findReplayInvoices(client, dealerCode),
    findReplayCollections(client, dealerCode),
  ]);

  const events: LedgerReplayEvent[] = [];

  if (openingBalance && !openingBalance.amount.equals(ZERO)) {
    const postingKey = buildOpeningBalancePostingKey(dealerCode);
    const amountAbs = openingBalance.amount.abs();
    const debit = openingBalance.amount.greaterThan(ZERO) ? amountAbs : ZERO;
    const credit = openingBalance.amount.lessThan(ZERO) ? amountAbs : ZERO;

    events.push({
      eventType: "OpeningBalance",
      phase: 0,
      transactionDate: openingBalance.effectiveDate,
      postingDate: openingBalance.effectiveDate,
      createdAt: openingBalance.effectiveDate,
      referenceType: FinancialReferenceType.OpeningBalance,
      referenceId: buildOpeningBalanceReferenceId(dealerCode),
      referenceNo: openingBalance.referenceNo ?? `OB-${dealerCode}`,
      postingType: LedgerPostingType.OpeningBalance,
      postingKey,
      debit,
      credit,
      createdById: openingBalance.createdById,
      remarks: "Historical replay — opening balance",
      reversesCollectionId: null,
    });
  }

  for (const invoice of invoices) {
    events.push({
      eventType: "Invoice",
      phase: 1,
      transactionDate: invoice.issueDate,
      postingDate: invoice.issueDate,
      createdAt: invoice.createdAt,
      referenceType: FINANCIAL_REFERENCE_INVOICE,
      referenceId: invoice.id,
      referenceNo: invoice.invoiceNo,
      postingType: LedgerPostingType.Issue,
      postingKey: buildLedgerPostingKey({
        referenceType: FINANCIAL_REFERENCE_INVOICE,
        referenceId: invoice.id,
        postingType: LedgerPostingType.Issue,
      }),
      debit: invoice.grandTotal,
      credit: ZERO,
      createdById: null,
      remarks: "Historical replay — invoice issue",
      reversesCollectionId: null,
    });
  }

  const confirmedCollections = collections.filter(
    (c) => c.status !== "Reversed",
  );
  for (const collection of confirmedCollections) {
    const transactionDate = collection.confirmedAt ?? collection.collectionDate;
    events.push({
      eventType: "Collection",
      phase: 2,
      transactionDate,
      postingDate: transactionDate,
      createdAt: collection.createdAt,
      referenceType: FINANCIAL_REFERENCE_COLLECTION,
      referenceId: collection.id,
      referenceNo: collection.collectionNo,
      postingType: LedgerPostingType.Collection,
      postingKey: buildLedgerPostingKey({
        referenceType: FINANCIAL_REFERENCE_COLLECTION,
        referenceId: collection.id,
        postingType: LedgerPostingType.Collection,
      }),
      debit: ZERO,
      credit: collection.receivedAmount,
      createdById: collection.confirmedById,
      remarks: collection.remarks,
      reversesCollectionId: null,
    });
  }

  const reversedCollections = collections.filter(
    (c) => c.status === "Reversed",
  );
  for (const collection of reversedCollections) {
    const confirmDate = collection.confirmedAt ?? collection.collectionDate;
    events.push({
      eventType: "Collection",
      phase: 2,
      transactionDate: confirmDate,
      postingDate: confirmDate,
      createdAt: collection.createdAt,
      referenceType: FINANCIAL_REFERENCE_COLLECTION,
      referenceId: collection.id,
      referenceNo: collection.collectionNo,
      postingType: LedgerPostingType.Collection,
      postingKey: buildLedgerPostingKey({
        referenceType: FINANCIAL_REFERENCE_COLLECTION,
        referenceId: collection.id,
        postingType: LedgerPostingType.Collection,
      }),
      debit: ZERO,
      credit: collection.receivedAmount,
      createdById: collection.confirmedById,
      remarks: collection.remarks,
      reversesCollectionId: null,
    });

    const reversalDate = collection.reversedAt ?? collection.createdAt;
    events.push({
      eventType: "Reversal",
      phase: 3,
      transactionDate: reversalDate,
      postingDate: reversalDate,
      createdAt: reversalDate,
      referenceType: FINANCIAL_REFERENCE_COLLECTION,
      referenceId: collection.id,
      referenceNo: collection.collectionNo,
      postingType: LedgerPostingType.Reversal,
      postingKey: buildLedgerPostingKey({
        referenceType: FINANCIAL_REFERENCE_COLLECTION,
        referenceId: collection.id,
        postingType: LedgerPostingType.Reversal,
      }),
      debit: collection.receivedAmount,
      credit: ZERO,
      createdById: collection.confirmedById,
      remarks: "Historical replay — collection reversal",
      reversesCollectionId: collection.id,
    });
  }

  return sortReplayEvents(events);
}

export function sortReplayEvents(
  events: LedgerReplayEvent[],
): LedgerReplayEvent[] {
  return [...events].sort((a, b) => {
    if (a.phase !== b.phase) {
      return a.phase - b.phase;
    }
    const txCmp = a.transactionDate.getTime() - b.transactionDate.getTime();
    if (txCmp !== 0) return txCmp;
    const postCmp = a.postingDate.getTime() - b.postingDate.getTime();
    if (postCmp !== 0) return postCmp;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export async function findExistingPostingKeys(
  client: ReplayReadClient,
  dealerCode: string,
  postingKeys: string[],
): Promise<Set<string>> {
  if (postingKeys.length === 0) {
    return new Set();
  }

  const rows = await client.ledgerEntry.findMany({
    where: {
      dealerCode,
      postingKey: { in: postingKeys },
    },
    select: { postingKey: true },
  });

  return new Set(rows.map((row) => row.postingKey));
}
