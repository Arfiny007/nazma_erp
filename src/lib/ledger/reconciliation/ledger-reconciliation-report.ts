import type {
  DealerReconciliationResult,
  ReconciliationReport,
  ReconciliationSummary,
} from "./ledger-reconciliation-types";

/**
 * Human-readable reconciliation report helpers — PHASE_07E3.
 *
 * Presentation only — no financial calculations.
 *
 * @see ADR-034
 */

export function buildReconciliationReport(
  dealers: DealerReconciliationResult[],
  summary: ReconciliationSummary,
): ReconciliationReport {
  return { summary, dealers };
}

export function formatReconciliationSummaryLine(
  summary: ReconciliationSummary,
): string {
  return [
    `Total: ${summary.totalDealers}`,
    `Consistent: ${summary.consistentDealers}`,
    `Drifted: ${summary.driftedDealers}`,
    `Missing Ledger: ${summary.missingLedgerDealers}`,
    `Corrupted: ${summary.corruptedDealers}`,
  ].join(" | ");
}
