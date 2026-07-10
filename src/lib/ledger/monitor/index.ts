/**
 * Scheduled Financial Integrity Monitor — public surface (PHASE_07E4).
 *
 * Orchestrates `reconcileAllDealers()` and persists scan summaries only.
 *
 * @see ADR-035
 */

export {
  runFinancialIntegrityScan,
  getLatestIntegrityScan,
  listIntegrityScans,
  type IntegrityMonitorClient,
} from "./ledger-monitor-service";

export {
  LedgerMonitorError,
  IntegrityScanNotFoundError,
  IntegrityScanPersistenceError,
} from "./ledger-monitor-errors";

export {
  normalizeListIntegrityScansParams,
  deriveScanStatus,
  toFinancialIntegrityScanResult,
  toFinancialIntegrityScanRecord,
} from "./ledger-monitor-validation";

export {
  createIntegrityScanRecord,
  createFailedIntegrityScanRecord,
  findLatestIntegrityScan,
  findIntegrityScans,
  listIntegrityScansFromParams,
  type IntegrityScanReadClient,
  type IntegrityScanWriteClient,
  type CreateIntegrityScanInput,
} from "./ledger-monitor-query";

export {
  formatIntegrityScanSummaryLine,
  hasIntegrityIssues,
  buildIntegrityScanHistoryReport,
} from "./ledger-monitor-report";

export type {
  FinancialIntegrityScanStatus,
  FinancialIntegrityScanResult,
  FinancialIntegrityScanRecord,
  ListIntegrityScansParams,
} from "./ledger-monitor-types";
