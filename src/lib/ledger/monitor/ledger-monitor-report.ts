import type {
  FinancialIntegrityScanRecord,
  FinancialIntegrityScanResult,
} from "./ledger-monitor-types";

/**
 * Human-readable integrity monitor report helpers — PHASE_07E4.
 *
 * Presentation only — no financial calculations.
 *
 * @see ADR-035
 */

export function formatIntegrityScanSummaryLine(
  scan: Pick<
    FinancialIntegrityScanResult,
    | "totalDealers"
    | "consistentDealers"
    | "driftedDealers"
    | "missingLedgerDealers"
    | "corruptedDealers"
    | "durationMs"
  >,
): string {
  return [
    `Total: ${scan.totalDealers}`,
    `Consistent: ${scan.consistentDealers}`,
    `Drifted: ${scan.driftedDealers}`,
    `Missing Ledger: ${scan.missingLedgerDealers}`,
    `Corrupted: ${scan.corruptedDealers}`,
    `Duration: ${scan.durationMs}ms`,
  ].join(" | ");
}

export function hasIntegrityIssues(
  scan: Pick<
    FinancialIntegrityScanResult,
    "driftedDealers" | "missingLedgerDealers" | "corruptedDealers"
  >,
): boolean {
  return (
    scan.driftedDealers > 0 ||
    scan.missingLedgerDealers > 0 ||
    scan.corruptedDealers > 0
  );
}

export function buildIntegrityScanHistoryReport(scans: FinancialIntegrityScanRecord[]) {
  return {
    scans,
    total: scans.length,
    latest: scans[0] ?? null,
  };
}
