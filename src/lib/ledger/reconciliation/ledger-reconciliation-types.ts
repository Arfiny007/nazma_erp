/**
 * Types for the Enterprise Reconciliation Engine — PHASE_07E3.
 *
 * Read-only integrity verification. Never mutates financial data.
 *
 * @see ADR-034
 */

/** Per-dealer reconciliation status. */
export type DealerReconciliationStatus =
  | "CONSISTENT"
  | "DRIFT"
  | "MISSING_LEDGER"
  | "CORRUPTED_CHAIN";

/** Per-dealer reconciliation result returned by `reconcileDealer()`. */
export interface DealerReconciliationResult {
  dealerCode: string;
  dealerName: string;
  dealerBalance: string;
  latestLedgerBalance: string;
  summedLedgerBalance: string;
  drift: string;
  ledgerEntryCount: number;
  status: DealerReconciliationStatus;
}

/** Repository-wide summary returned by `reconcileAllDealers()`. */
export interface ReconciliationSummary {
  totalDealers: number;
  consistentDealers: number;
  driftedDealers: number;
  missingLedgerDealers: number;
  corruptedDealers: number;
}

/** Full repository reconciliation report. */
export interface ReconciliationReport {
  summary: ReconciliationSummary;
  dealers: DealerReconciliationResult[];
}

/** Raw metrics gathered before status classification. */
export interface DealerReconciliationMetrics {
  dealerCode: string;
  dealerName: string;
  dealerBalance: import("@prisma/client").Prisma.Decimal;
  latestLedgerBalance: import("@prisma/client").Prisma.Decimal;
  summedLedgerBalance: import("@prisma/client").Prisma.Decimal;
  drift: import("@prisma/client").Prisma.Decimal;
  ledgerEntryCount: number;
  isChainValid: boolean;
  isReplayValid: boolean;
  isCacheValid: boolean;
}
