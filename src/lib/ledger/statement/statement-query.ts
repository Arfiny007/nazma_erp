import { Prisma } from "@prisma/client";
import type { FinancialReferenceType, LedgerPostingType } from "@prisma/client";

/**
 * Raw read queries backing the Dealer Statement engine — PHASE_07D1.
 *
 * Every function here is a plain Prisma read. No `create`, `update`,
 * `upsert`, or `delete` call appears in this file, and none ever will:
 * this module must remain read-only for the lifetime of the ERP.
 *
 * Data sources are restricted to exactly the models named in PHASE_07D1:
 * `Dealer`, `LedgerEntry`, `OpeningBalance`. `Invoice` and `Collection`
 * are intentionally NOT queried here — `LedgerEntry` is the sole
 * authoritative source for statement rows (see ADR-024, ADR-025).
 *
 * @see ADR-029
 */

const ZERO = new Prisma.Decimal(0);

/** Minimal Prisma surface this module depends on — accepts `prisma` or a `tx`. */
export type StatementReadClient = Pick<
  Prisma.TransactionClient,
  "dealer" | "ledgerEntry" | "openingBalance"
>;

/** Canonical statement ordering — `transactionDate` is the business/value date (ADR-025). */
const STATEMENT_ORDER_BY: Prisma.LedgerEntryOrderByWithRelationInput[] = [
  { transactionDate: "asc" },
  { postingDate: "asc" },
  { id: "asc" },
];

const STATEMENT_ORDER_BY_DESC: Prisma.LedgerEntryOrderByWithRelationInput[] = [
  { transactionDate: "desc" },
  { postingDate: "desc" },
  { id: "desc" },
];

function buildTransactionDateFilter(
  fromDate?: Date,
  toDate?: Date,
): Prisma.DateTimeFilter | undefined {
  if (!fromDate && !toDate) {
    return undefined;
  }
  const filter: Prisma.DateTimeFilter = {};
  if (fromDate) {
    filter.gte = fromDate;
  }
  if (toDate) {
    filter.lte = toDate;
  }
  return filter;
}

/* -------------------------------------------------------------------------- */
/*                                    Dealer                                  */
/* -------------------------------------------------------------------------- */

export interface StatementDealerRow {
  dealerCode: string;
  companyName: string;
  currentBalance: Prisma.Decimal;
  creditLimit: Prisma.Decimal;
}

export async function findDealerForStatement(
  client: StatementReadClient,
  dealerCode: string,
): Promise<StatementDealerRow | null> {
  return client.dealer.findUnique({
    where: { dealerCode },
    select: {
      dealerCode: true,
      companyName: true,
      currentBalance: true,
      creditLimit: true,
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                               Opening balance                              */
/* -------------------------------------------------------------------------- */

export interface StatementOpeningBalanceRow {
  amount: Prisma.Decimal;
  effectiveDate: Date;
  status: string;
}

export async function findOpeningBalanceForDealer(
  client: StatementReadClient,
  dealerCode: string,
): Promise<StatementOpeningBalanceRow | null> {
  return client.openingBalance.findUnique({
    where: { dealerCode },
    select: { amount: true, effectiveDate: true, status: true },
  });
}

/* -------------------------------------------------------------------------- */
/*                                Ledger entries                              */
/* -------------------------------------------------------------------------- */

export interface StatementLedgerEntryRow {
  id: string;
  transactionDate: Date;
  postingDate: Date;
  referenceType: FinancialReferenceType;
  referenceId: string;
  referenceNo: string;
  postingType: LedgerPostingType;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  /** Verbatim `LedgerEntry.balance` — the authoritative running balance. */
  balance: Prisma.Decimal;
  createdById: string | null;
  createdByName: string | null;
  remarks: string | null;
}

export interface StatementDateRangeParams {
  dealerCode: string;
  fromDate?: Date;
  toDate?: Date;
}

export async function countLedgerEntriesForDealer(
  client: StatementReadClient,
  params: StatementDateRangeParams,
): Promise<number> {
  const transactionDate = buildTransactionDateFilter(params.fromDate, params.toDate);
  return client.ledgerEntry.count({
    where: {
      dealerCode: params.dealerCode,
      ...(transactionDate ? { transactionDate } : {}),
    },
  });
}

export async function findLedgerEntriesPageForDealer(
  client: StatementReadClient,
  params: StatementDateRangeParams & { skip: number; take: number },
): Promise<StatementLedgerEntryRow[]> {
  const transactionDate = buildTransactionDateFilter(params.fromDate, params.toDate);
  const rows = await client.ledgerEntry.findMany({
    where: {
      dealerCode: params.dealerCode,
      ...(transactionDate ? { transactionDate } : {}),
    },
    orderBy: STATEMENT_ORDER_BY,
    skip: params.skip,
    take: params.take,
    include: { createdBy: { select: { name: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    transactionDate: row.transactionDate,
    postingDate: row.postingDate,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    referenceNo: row.referenceNo,
    postingType: row.postingType,
    debit: row.debit,
    credit: row.credit,
    balance: row.balance,
    createdById: row.createdById,
    createdByName: row.createdBy?.name ?? null,
    remarks: row.remarks,
  }));
}

export interface StatementLedgerTotals {
  totalDebit: Prisma.Decimal;
  totalCredit: Prisma.Decimal;
  entryCount: number;
}

/** Aggregates debit/credit and counts entries across the ENTIRE filtered range (not a page). */
export async function aggregateLedgerTotalsForDealer(
  client: StatementReadClient,
  params: StatementDateRangeParams,
): Promise<StatementLedgerTotals> {
  const transactionDate = buildTransactionDateFilter(params.fromDate, params.toDate);
  const where: Prisma.LedgerEntryWhereInput = {
    dealerCode: params.dealerCode,
    ...(transactionDate ? { transactionDate } : {}),
  };

  const [agg, entryCount] = await Promise.all([
    client.ledgerEntry.aggregate({
      where,
      _sum: { debit: true, credit: true },
    }),
    client.ledgerEntry.count({ where }),
  ]);

  return {
    totalDebit: agg._sum.debit ?? ZERO,
    totalCredit: agg._sum.credit ?? ZERO,
    entryCount,
  };
}

/**
 * Balance of the last `LedgerEntry` strictly BEFORE `beforeDate` — the
 * carry-forward "opening balance for range" when a statement is filtered by
 * `fromDate`. Returns `null` when no such entry exists. Read verbatim; never
 * recomputed.
 */
export async function findLastLedgerEntryBefore(
  client: StatementReadClient,
  params: { dealerCode: string; beforeDate: Date },
): Promise<Prisma.Decimal | null> {
  const row = await client.ledgerEntry.findFirst({
    where: {
      dealerCode: params.dealerCode,
      transactionDate: { lt: params.beforeDate },
    },
    orderBy: STATEMENT_ORDER_BY_DESC,
    select: { balance: true },
  });
  return row?.balance ?? null;
}

export interface StatementLedgerDateBounds {
  firstEntryDate: Date | null;
  lastEntryDate: Date | null;
}

/** First/last `transactionDate` across the filtered range — used by the summary read. */
export async function findLedgerDateBoundsForDealer(
  client: StatementReadClient,
  params: StatementDateRangeParams,
): Promise<StatementLedgerDateBounds> {
  const transactionDate = buildTransactionDateFilter(params.fromDate, params.toDate);
  const where: Prisma.LedgerEntryWhereInput = {
    dealerCode: params.dealerCode,
    ...(transactionDate ? { transactionDate } : {}),
  };

  const [first, last] = await Promise.all([
    client.ledgerEntry.findFirst({
      where,
      orderBy: STATEMENT_ORDER_BY,
      select: { transactionDate: true },
    }),
    client.ledgerEntry.findFirst({
      where,
      orderBy: STATEMENT_ORDER_BY_DESC,
      select: { transactionDate: true },
    }),
  ]);

  return {
    firstEntryDate: first?.transactionDate ?? null,
    lastEntryDate: last?.transactionDate ?? null,
  };
}
