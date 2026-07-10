/**
 * Types for the Scheduled Financial Integrity Monitor — PHASE_07E4.
 *
 * Orchestrates `reconcileAllDealers()` and persists scan summaries only.
 * Individual dealer reports remain on-demand via the reconciliation engine.
 *
 * @see ADR-035
 */

/** Scan execution status persisted on `FinancialIntegrityScan`. */
export type FinancialIntegrityScanStatus = "Completed" | "Failed";

/** Result returned by `runFinancialIntegrityScan()`. */
export interface FinancialIntegrityScanResult {
  scanId: string;
  totalDealers: number;
  consistentDealers: number;
  driftedDealers: number;
  missingLedgerDealers: number;
  corruptedDealers: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

/** Stored scan row exposed to server actions and dev UI. */
export interface FinancialIntegrityScanRecord extends FinancialIntegrityScanResult {
  status: FinancialIntegrityScanStatus;
  createdAt: string;
  updatedAt: string;
}

/** Parameters for listing historical scans. */
export interface ListIntegrityScansParams {
  limit?: number;
}
