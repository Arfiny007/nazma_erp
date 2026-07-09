import { Prisma } from "@prisma/client";

import type {
  DealerReconciliationMetrics,
  DealerReconciliationResult,
  DealerReconciliationStatus,
  ReconciliationSummary,
} from "./ledger-reconciliation-types";

/**
 * Pure classification rules for PHASE_07E3 reconciliation.
 *
 * Rules verified:
 *   A — `latest LedgerEntry.balance == Dealer.currentBalance`
 *   B — `SUM(debit) - SUM(credit) == latest LedgerEntry.balance`
 *   C — running balance chain integrity
 *
 * @see ADR-034
 */

const ZERO = new Prisma.Decimal(0);

export function classifyReconciliationStatus(
  metrics: Pick<
    DealerReconciliationMetrics,
    | "dealerBalance"
    | "latestLedgerBalance"
    | "summedLedgerBalance"
    | "ledgerEntryCount"
    | "isChainValid"
    | "isReplayValid"
    | "isCacheValid"
  >,
): DealerReconciliationStatus {
  const {
    dealerBalance,
    ledgerEntryCount,
    isChainValid,
    isReplayValid,
    isCacheValid,
  } = metrics;

  if (ledgerEntryCount === 0) {
    return dealerBalance.equals(ZERO) ? "CONSISTENT" : "MISSING_LEDGER";
  }

  if (!isChainValid || !isReplayValid) {
    return "CORRUPTED_CHAIN";
  }

  if (!isCacheValid) {
    return "DRIFT";
  }

  if (
    !metrics.latestLedgerBalance.equals(metrics.summedLedgerBalance) ||
    !metrics.latestLedgerBalance.equals(dealerBalance)
  ) {
    return "DRIFT";
  }

  return "CONSISTENT";
}

export function toDealerReconciliationResult(
  metrics: DealerReconciliationMetrics,
): DealerReconciliationResult {
  return {
    dealerCode: metrics.dealerCode,
    dealerName: metrics.dealerName,
    dealerBalance: metrics.dealerBalance.toFixed(2),
    latestLedgerBalance: metrics.latestLedgerBalance.toFixed(2),
    summedLedgerBalance: metrics.summedLedgerBalance.toFixed(2),
    drift: metrics.drift.toFixed(2),
    ledgerEntryCount: metrics.ledgerEntryCount,
    status: classifyReconciliationStatus(metrics),
  };
}

export function summarizeReconciliationResults(
  dealers: DealerReconciliationResult[],
): ReconciliationSummary {
  const summary: ReconciliationSummary = {
    totalDealers: dealers.length,
    consistentDealers: 0,
    driftedDealers: 0,
    missingLedgerDealers: 0,
    corruptedDealers: 0,
  };

  for (const dealer of dealers) {
    switch (dealer.status) {
      case "CONSISTENT":
        summary.consistentDealers += 1;
        break;
      case "DRIFT":
        summary.driftedDealers += 1;
        break;
      case "MISSING_LEDGER":
        summary.missingLedgerDealers += 1;
        break;
      case "CORRUPTED_CHAIN":
        summary.corruptedDealers += 1;
        break;
      default: {
        const _exhaustive: never = dealer.status;
        void _exhaustive;
      }
    }
  }

  return summary;
}
