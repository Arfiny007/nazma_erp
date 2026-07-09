import { Prisma } from "@prisma/client";

import type {
  DealerBackfillMetrics,
  LedgerBackfillCandidate,
  LedgerBackfillDiscoverySummary,
  LedgerBackfillReason,
} from "./ledger-backfill-types";

/**
 * Pure classification rules for PHASE_07E1 discovery.
 *
 * Priority:
 *   1. CACHE_DRIFT — ledger balance ≠ `Dealer.currentBalance`
 *   2. NO_LEDGER — non-zero cache with zero ledger rows
 *   3. PARTIAL_LEDGER — financial documents exist but ledger rows are missing
 *   4. RECONCILED — otherwise
 *
 * @see ADR-032
 */

const ZERO = new Prisma.Decimal(0);

const POSTED_OPENING_BALANCE_STATUSES = new Set(["Posted", "Locked"]);

export function hasPostedOpeningBalance(
  status: string | null | undefined,
): boolean {
  return status != null && POSTED_OPENING_BALANCE_STATUSES.has(status);
}

export function hasFinancialDocuments(
  invoiceCount: number,
  collectionCount: number,
): boolean {
  return invoiceCount > 0 || collectionCount > 0;
}

export function expectedMinimumLedgerEntries(
  invoiceCount: number,
  collectionCount: number,
): number {
  return invoiceCount + collectionCount;
}

export function hasMissingLedgerRows(
  ledgerEntryCount: number,
  invoiceCount: number,
  collectionCount: number,
): boolean {
  if (ledgerEntryCount === 0) {
    return hasFinancialDocuments(invoiceCount, collectionCount);
  }
  return ledgerEntryCount < expectedMinimumLedgerEntries(invoiceCount, collectionCount);
}

export function classifyBackfillReason(
  metrics: Pick<
    DealerBackfillMetrics,
    | "currentBalance"
    | "ledgerEntryCount"
    | "ledgerBalance"
    | "invoiceCount"
    | "collectionCount"
  >,
): LedgerBackfillReason {
  const {
    currentBalance,
    ledgerEntryCount,
    ledgerBalance,
    invoiceCount,
    collectionCount,
  } = metrics;

  if (
    ledgerEntryCount > 0 &&
    !ledgerBalance.equals(currentBalance)
  ) {
    return "CACHE_DRIFT";
  }

  if (!currentBalance.equals(ZERO) && ledgerEntryCount === 0) {
    return "NO_LEDGER";
  }

  if (hasMissingLedgerRows(ledgerEntryCount, invoiceCount, collectionCount)) {
    return "PARTIAL_LEDGER";
  }

  return "RECONCILED";
}

export function requiresBackfill(reason: LedgerBackfillReason): boolean {
  return reason !== "RECONCILED";
}

export function toBackfillCandidate(
  metrics: DealerBackfillMetrics,
): LedgerBackfillCandidate {
  const reason = classifyBackfillReason(metrics);

  return {
    dealerCode: metrics.dealerCode,
    dealerName: metrics.dealerName,
    currentBalance: metrics.currentBalance.toFixed(2),
    ledgerEntryCount: metrics.ledgerEntryCount,
    invoiceCount: metrics.invoiceCount,
    collectionCount: metrics.collectionCount,
    openingBalanceExists: metrics.openingBalanceExists,
    requiresBackfill: requiresBackfill(reason),
    reason,
  };
}

export function summarizeBackfillCandidates(
  candidates: LedgerBackfillCandidate[],
): LedgerBackfillDiscoverySummary {
  const summary: LedgerBackfillDiscoverySummary = {
    dealerCount: candidates.length,
    requiresBackfillCount: 0,
    reconciledCount: 0,
    noLedgerCount: 0,
    partialLedgerCount: 0,
    cacheDriftCount: 0,
  };

  for (const candidate of candidates) {
    switch (candidate.reason) {
      case "NO_LEDGER":
        summary.noLedgerCount += 1;
        summary.requiresBackfillCount += 1;
        break;
      case "PARTIAL_LEDGER":
        summary.partialLedgerCount += 1;
        summary.requiresBackfillCount += 1;
        break;
      case "CACHE_DRIFT":
        summary.cacheDriftCount += 1;
        summary.requiresBackfillCount += 1;
        break;
      case "RECONCILED":
        summary.reconciledCount += 1;
        break;
      default: {
        const _exhaustive: never = candidate.reason;
        void _exhaustive;
      }
    }
  }

  return summary;
}
