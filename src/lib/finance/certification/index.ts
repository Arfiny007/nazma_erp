/**
 * Enterprise Financial System Certification — PHASE_07F.
 *
 * Read-only verification across every financial subsystem.
 * Never mutates financial data.
 *
 * @see ADR-037
 */

export {
  FINANCIAL_CERTIFICATION_VERSION,
  PRODUCTION_READINESS_THRESHOLD,
} from "./financial-certification-types";

export type {
  CertificationCheckCategory,
  CertificationCheckDefinition,
  CertificationCheckResult,
  CertificationCheckSeverity,
  CertificationPerformanceSnapshot,
  CertificationRunContext,
  CertificationStatus,
  CertificationSubsystem,
  FinancialCertificationReport,
  FinancialCertificationResult,
} from "./financial-certification-types";

export {
  CERTIFICATION_CHECK_CATALOG,
  aggregateSubsystemStatuses,
  computeOverallScore,
  resolveDatabaseAvailability,
  runAllCertificationChecks,
  scanCreateLedgerEntryImports,
  scanForbiddenMutations,
  verifyIntegrityMonitorOrchestration,
} from "./financial-certification-validation";

export {
  buildFinancialCertificationResult,
  runFinancialCertification,
  runFinancialCertificationWithReport,
} from "./financial-certification-service";

export {
  REQUIRED_MANUAL_CHECKS,
  REMAINING_RISKS,
  SUBSYSTEM_LABELS,
  buildCertificationExecutiveSummary,
  buildFinancialCertificationReport,
  formatCertificationSummaryLine,
  formatSubsystemScoreLine,
} from "./financial-certification-report";
