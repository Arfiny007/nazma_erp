import { Prisma } from "@prisma/client";

import { getLastLedgerEntryForDealer } from "@/lib/ledger/ledger-reconciliation";

import type { DealerBackfillMetrics } from "./ledger-backfill-types";

/**
 * Read-only queries backing ledger backfill discovery — PHASE_07E1.
 *
 * No `create`, `update`, `upsert`, or `delete` calls appear here.
 *
 * @see ADR-032
 */

const ZERO = new Prisma.Decimal(0);

/** Issued receivables that should have produced a ledger Issue posting. */
const LEDGER_ELIGIBLE_INVOICE_STATUSES: Prisma.EnumInvoiceStatusFilter["in"] = [
  "Issued",
  "Paid",
  "Partial",
  "Overdue",
];

/** Confirmed cash receipts that should have produced a ledger Collection posting. */
const LEDGER_ELIGIBLE_COLLECTION_STATUSES: Prisma.EnumCollectionStatusFilter["in"] = [
  "Confirmed",
  "PartiallyAllocated",
  "Allocated",
];

export type BackfillReadClient = Pick<
  Prisma.TransactionClient,
  "dealer" | "ledgerEntry" | "invoice" | "collection" | "openingBalance"
>;

export async function findAllDealersForBackfillDiscovery(
  client: BackfillReadClient,
): Promise<
  Array<{
    dealerCode: string;
    dealerName: string;
    currentBalance: Prisma.Decimal;
  }>
> {
  const dealers = await client.dealer.findMany({
    select: {
      dealerCode: true,
      companyName: true,
      currentBalance: true,
    },
    orderBy: { dealerCode: "asc" },
  });

  return dealers.map((dealer) => ({
    dealerCode: dealer.dealerCode,
    dealerName: dealer.companyName,
    currentBalance: dealer.currentBalance,
  }));
}

async function countLedgerEntriesByDealer(
  client: BackfillReadClient,
): Promise<Map<string, number>> {
  const rows = await client.ledgerEntry.groupBy({
    by: ["dealerCode"],
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.dealerCode, row._count._all]));
}

async function countInvoicesByDealer(
  client: BackfillReadClient,
): Promise<Map<string, number>> {
  const rows = await client.invoice.groupBy({
    by: ["dealerCode"],
    where: {
      status: { in: LEDGER_ELIGIBLE_INVOICE_STATUSES },
    },
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.dealerCode, row._count._all]));
}

async function countCollectionsByDealer(
  client: BackfillReadClient,
): Promise<Map<string, number>> {
  const rows = await client.collection.groupBy({
    by: ["dealerCode"],
    where: {
      status: { in: LEDGER_ELIGIBLE_COLLECTION_STATUSES },
    },
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.dealerCode, row._count._all]));
}

async function findPostedOpeningBalanceDealers(
  client: BackfillReadClient,
): Promise<Set<string>> {
  const rows = await client.openingBalance.findMany({
    where: {
      status: { in: ["Posted", "Locked"] },
    },
    select: { dealerCode: true },
  });

  return new Set(rows.map((row) => row.dealerCode));
}

/**
 * Gather per-dealer metrics for discovery classification.
 *
 * Uses batched `groupBy` queries for invoice/collection/ledger counts and
 * fetches the last ledger balance per dealer only when rows exist.
 */
export async function gatherDealerBackfillMetrics(
  client: BackfillReadClient,
): Promise<DealerBackfillMetrics[]> {
  const [dealers, ledgerCounts, invoiceCounts, collectionCounts, openingBalanceDealers] =
    await Promise.all([
      findAllDealersForBackfillDiscovery(client),
      countLedgerEntriesByDealer(client),
      countInvoicesByDealer(client),
      countCollectionsByDealer(client),
      findPostedOpeningBalanceDealers(client),
    ]);

  const metrics: DealerBackfillMetrics[] = [];

  for (const dealer of dealers) {
    const ledgerEntryCount = ledgerCounts.get(dealer.dealerCode) ?? 0;
    let ledgerBalance = ZERO;

    if (ledgerEntryCount > 0) {
      const lastEntry = await getLastLedgerEntryForDealer(client, dealer.dealerCode);
      ledgerBalance = lastEntry?.balance ?? ZERO;
    }

    metrics.push({
      dealerCode: dealer.dealerCode,
      dealerName: dealer.dealerName,
      currentBalance: dealer.currentBalance,
      ledgerEntryCount,
      ledgerBalance,
      invoiceCount: invoiceCounts.get(dealer.dealerCode) ?? 0,
      collectionCount: collectionCounts.get(dealer.dealerCode) ?? 0,
      openingBalanceExists: openingBalanceDealers.has(dealer.dealerCode),
    });
  }

  return metrics;
}
