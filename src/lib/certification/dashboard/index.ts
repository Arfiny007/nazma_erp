export {
  buildDashboardCertificationExecutiveSummary,
  buildDashboardCertificationReport,
  formatDashboardCertificationSummaryLine,
  formatDashboardSubsystemScoreLine,
} from "./dashboard-certification-report";
export {
  buildDashboardCertificationResult,
  runDashboardCertification,
  runDashboardCertificationWithReport,
} from "./dashboard-certification-service";
export type {
  DashboardCertificationCheckResult,
  DashboardCertificationReport,
  DashboardCertificationResult,
  DashboardCertificationStatus,
  DashboardCertificationSubsystem,
  DashboardPerformanceAudit,
  DashboardPerformanceMeasurement,
} from "./dashboard-certification-types";
export {
  DASHBOARD_CERTIFICATION_VERSION,
  DASHBOARD_PRODUCTION_READINESS_THRESHOLD,
} from "./dashboard-certification-types";
export {
  aggregateSubsystemStatuses,
  computeOverallScore,
  countDashboardQuerySurface,
  DASHBOARD_CERTIFICATION_CHECK_CATALOG,
  normalizeMoneyDisplay,
  resolveDatabaseAvailability,
  runAllDashboardCertificationChecks,
  scanDashboardArchitectureImports,
  scanDashboardClientSideMoneyMath,
  scanDashboardFinancialBoundary,
  scanDashboardTerritoryLeakage,
  verifyDashboardKpiParity,
  verifyDashboardSrIsolationBehavior,
  verifyLiveKpiParity,
  verifyLiveReconciliationParity,
} from "./dashboard-certification-validation";
