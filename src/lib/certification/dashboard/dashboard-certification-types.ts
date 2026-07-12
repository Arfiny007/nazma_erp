/**
 * Types for Enterprise Dashboard Certification — PHASE_09A.5.
 *
 * Read-only verification across PHASE_09A dashboard layer.
 * Never mutates financial or organizational data.
 *
 * @see ADR-043
 */

/** Certification version — bump when check catalog changes materially. */
export const DASHBOARD_CERTIFICATION_VERSION = "1.0.0";

/** Minimum overall score required to approve PHASE_09B. */
export const DASHBOARD_PRODUCTION_READINESS_THRESHOLD = 9.0;

/** Subsystem keys audited by `runDashboardCertification()`. */
export type DashboardCertificationSubsystem =
  | "security"
  | "financial"
  | "performance"
  | "architecture";

/** Per-subsystem certification outcome. */
export interface DashboardCertificationStatus {
  score: number;
  passed: boolean;
  passedChecks: number;
  failedChecks: number;
  warnings: number;
}

/** Performance measurement for a single role dashboard load. */
export interface DashboardPerformanceMeasurement {
  role: "SR" | "Manager" | "Accounts" | "Super_Admin";
  userId: string;
  durationMs: number;
  payloadBytes: number;
  withinTarget: boolean;
}

/** Aggregated performance audit metrics — Rule 8. */
export interface DashboardPerformanceAudit {
  measurements: DashboardPerformanceMeasurement[];
  slowestRole: DashboardPerformanceMeasurement["role"] | null;
  slowestDurationMs: number;
  largestPayloadBytes: number;
  estimatedQuerySurface: number;
  allWithinTarget: boolean;
  liveDatabase: boolean;
}

/** Result returned by `runDashboardCertification()`. */
export interface DashboardCertificationResult {
  certificationVersion: string;
  overallScore: number;
  securityScore: number;
  financialScore: number;
  performanceScore: number;
  architectureScore: number;
  passedChecks: number;
  failedChecks: number;
  warningCount: number;
  subsystems: Record<DashboardCertificationSubsystem, DashboardCertificationStatus>;
  findings: string[];
  warnings: string[];
  risks: string[];
  productionReady: boolean;
  phase09bApproved: boolean;
  performanceAudit: DashboardPerformanceAudit;
}

export type DashboardCertificationCheckSeverity = "critical" | "warning" | "info";

export type DashboardCertificationCheckCategory =
  | "sr_isolation"
  | "manager_isolation"
  | "accounts_visibility"
  | "admin_visibility"
  | "financial_authority"
  | "kpi_integrity"
  | "territory_leakage"
  | "performance"
  | "architecture";

/** Definition of a certification check. */
export interface DashboardCertificationCheckDefinition {
  id: string;
  name: string;
  subsystem: DashboardCertificationSubsystem;
  category: DashboardCertificationCheckCategory;
  severity: DashboardCertificationCheckSeverity;
  ruleNumber?: number;
}

/** Outcome of a single certification check. */
export interface DashboardCertificationCheckResult {
  id: string;
  name: string;
  subsystem: DashboardCertificationSubsystem;
  category: DashboardCertificationCheckCategory;
  severity: DashboardCertificationCheckSeverity;
  passed: boolean;
  warning: boolean;
  message: string;
  durationMs: number;
}

/** Internal context passed through the certification runner. */
export interface DashboardCertificationRunContext {
  databaseAvailable: boolean;
  startedAt: Date;
}

/** Full certification report with check details and risk summary. */
export interface DashboardCertificationReport {
  result: DashboardCertificationResult;
  checks: DashboardCertificationCheckResult[];
  remainingRisks: string[];
  requiredManualChecks: string[];
  generatedAt: string;
}
