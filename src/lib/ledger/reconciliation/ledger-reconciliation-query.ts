import { Prisma } from "@prisma/client";

import {
  getLastLedgerEntryForDealer,
  replayDealerLedgerBalance,
  validateDealerLedgerChain,
} from "@/lib/ledger/ledger-reconciliation";

import type { DealerReconciliationMetrics } from "./ledger-reconciliation-types";

/**
 * Read-only queries backing the reconciliation engine — PHASE_07E3.
 *
 * No `create`, `update`, `upsert`, or `delete` calls appear here.
 *
 * @see ADR-034
 */

const ZERO = new Prisma.Decimal(0);

export type ReconciliationReadClient = Pick<
  Prisma.TransactionClient,
  "dealer" | "ledgerEntry"
>;

export async function findAllDealersForReconciliation(
  client: ReconciliationReadClient,
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

export async function gatherDealerReconciliationMetrics(
  client: ReconciliationReadClient,
  dealerCode: string,
  dealerName: string,
  dealerBalance: Prisma.Decimal,
): Promise<DealerReconciliationMetrics> {
  const [lastEntry, chain, summedLedgerBalance, entryCount] = await Promise.all([
    getLastLedgerEntryForDealer(client, dealerCode),
    validateDealerLedgerChain(client, dealerCode),
    replayDealerLedgerBalance(client, dealerCode),
    client.ledgerEntry.count({ where: { dealerCode } }),
  ]);

  const latestLedgerBalance = lastEntry?.balance ?? ZERO;
  const drift = latestLedgerBalance.minus(dealerBalance);

  return {
    dealerCode,
    dealerName,
    dealerBalance,
    latestLedgerBalance,
    summedLedgerBalance,
    drift,
    ledgerEntryCount: entryCount,
    isChainValid: chain.isChainValid,
    isReplayValid: chain.isReplayValid,
    isCacheValid: chain.isCacheValid,
  };
}
