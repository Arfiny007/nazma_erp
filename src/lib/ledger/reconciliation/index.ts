/**
 * Enterprise Reconciliation Engine — public surface (PHASE_07E3).
 *
 * Read-only integrity verification. Never mutates `LedgerEntry` or
 * `Dealer.currentBalance`.
 *
 * @see ADR-034
 */

export {
  reconcileDealer,
  reconcileAllDealers,
  getReconciliationSummary,
} from "./ledger-reconciliation-service";

export {
  LedgerReconciliationEngineError,
  DealerReconciliationNotFoundError,
} from "./ledger-reconciliation-errors";

export {
  classifyReconciliationStatus,
  summarizeReconciliationResults,
  toDealerReconciliationResult,
} from "./ledger-reconciliation-validation";

export {
  findAllDealersForReconciliation,
  gatherDealerReconciliationMetrics,
  type ReconciliationReadClient,
} from "./ledger-reconciliation-query";

export {
  buildReconciliationReport,
  formatReconciliationSummaryLine,
} from "./ledger-reconciliation-report";

export type {
  DealerReconciliationResult,
  DealerReconciliationStatus,
  ReconciliationReport,
  ReconciliationSummary,
  DealerReconciliationMetrics,
} from "./ledger-reconciliation-types";
