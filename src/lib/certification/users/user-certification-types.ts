/**
 * Types for Enterprise User Management Certification — PHASE_10B.
 *
 * Read-only verification across PHASE_10A user management layer.
 * Never mutates financial or organizational data.
 *
 * @see ADR-050
 */

export const USER_CERTIFICATION_VERSION = "1.0.0";

export const USER_PRODUCTION_READINESS_THRESHOLD = 9.0;

export const USER_PERFORMANCE_TARGET_MS = 1000;

export type UserCertificationSubsystem =
  | "security"
  | "territoryIsolation"
  | "lifecycle"
  | "auditCoverage"
  | "financialBoundary"
  | "architecture"
  | "performance";

export interface UserCertificationStatus {
  score: number;
  passed: boolean;
  passedChecks: number;
  failedChecks: number;
  warnings: number;
}

/** User management audit trail coverage — Rule 8. */
export interface UserAuditCoverageReport {
  covered: string[];
  missing: string[];
  partial: string[];
}

export interface UserPerformanceMeasurement {
  operation: "listUsers" | "searchUsers" | "getUser";
  role: "SR" | "Manager" | "Accounts" | "Super_Admin";
  userId: string;
  durationMs: number;
  queryCountEstimate: number;
  withinTarget: boolean;
}

export interface UserPerformanceAudit {
  measurements: UserPerformanceMeasurement[];
  slowestOperation: UserPerformanceMeasurement["operation"] | null;
  slowestDurationMs: number;
  estimatedQuerySurface: number;
  allWithinTarget: boolean;
  liveDatabase: boolean;
}

export interface UserCertificationResult {
  certificationVersion: string;
  overallScore: number;
  securityScore: number;
  territoryIsolationScore: number;
  lifecycleScore: number;
  auditCoverageScore: number;
  financialBoundaryScore: number;
  architectureScore: number;
  performanceScore: number;
  passedChecks: number;
  failedChecks: number;
  warningCount: number;
  subsystems: Record<UserCertificationSubsystem, UserCertificationStatus>;
  auditCoverage: UserAuditCoverageReport;
  findings: string[];
  warnings: string[];
  risks: string[];
  productionReady: boolean;
  phase10cApproved: boolean;
  performanceAudit: UserPerformanceAudit;
}

export type UserCertificationCheckSeverity = "critical" | "warning" | "info";

export type UserCertificationCheckCategory =
  | "super_admin_authority"
  | "manager_isolation"
  | "sr_isolation"
  | "accounts_restrictions"
  | "territory_security"
  | "privilege_escalation"
  | "lifecycle_correctness"
  | "audit_completeness"
  | "financial_boundary"
  | "architecture"
  | "performance"
  | "security";

export interface UserCertificationCheckDefinition {
  id: string;
  name: string;
  subsystem: UserCertificationSubsystem;
  category: UserCertificationCheckCategory;
  severity: UserCertificationCheckSeverity;
  ruleNumber?: number;
}

export interface UserCertificationCheckResult {
  id: string;
  name: string;
  subsystem: UserCertificationSubsystem;
  category: UserCertificationCheckCategory;
  severity: UserCertificationCheckSeverity;
  passed: boolean;
  warning: boolean;
  message: string;
  durationMs: number;
}

export interface UserCertificationReport {
  result: UserCertificationResult;
  checks: UserCertificationCheckResult[];
  remainingRisks: string[];
  requiredManualChecks: string[];
  generatedAt: string;
}
