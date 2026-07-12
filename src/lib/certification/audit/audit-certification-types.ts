/**
 * Types for Enterprise Audit & Compliance Certification — PHASE_09D.5.
 *
 * Read-only verification across PHASE_09D audit console layer.
 * Never mutates financial or organizational data.
 *
 * @see ADR-047
 */

export const AUDIT_CERTIFICATION_VERSION = "1.0.0";

export const AUDIT_PRODUCTION_READINESS_THRESHOLD = 9.0;

export const AUDIT_PERFORMANCE_TARGET_MS = 1000;

export type AuditCertificationSubsystem =
  | "security"
  | "financialIntegrity"
  | "territoryIsolation"
  | "auditCoverage"
  | "architecture"
  | "performance";

export interface AuditCertificationStatus {
  score: number;
  passed: boolean;
  passedChecks: number;
  failedChecks: number;
  warnings: number;
}

/** Workflow audit trail coverage — Rule 7. */
export interface AuditCoverageReport {
  covered: string[];
  missing: string[];
  partial: string[];
}

export interface AuditPerformanceMeasurement {
  role: "SR" | "Manager" | "Accounts" | "Super_Admin";
  userId: string;
  durationMs: number;
  payloadBytes: number;
  queryCountEstimate: number;
  withinTarget: boolean;
}

export interface AuditPerformanceAudit {
  measurements: AuditPerformanceMeasurement[];
  slowestRole: AuditPerformanceMeasurement["role"] | null;
  slowestDurationMs: number;
  largestPayloadBytes: number;
  estimatedQuerySurface: number;
  allWithinTarget: boolean;
  liveDatabase: boolean;
}

export interface AuditCertificationResult {
  certificationVersion: string;
  overallScore: number;
  securityScore: number;
  financialIntegrityScore: number;
  territoryIsolationScore: number;
  auditCoverageScore: number;
  architectureScore: number;
  performanceScore: number;
  passedChecks: number;
  failedChecks: number;
  warningCount: number;
  subsystems: Record<AuditCertificationSubsystem, AuditCertificationStatus>;
  coverage: AuditCoverageReport;
  findings: string[];
  warnings: string[];
  risks: string[];
  productionReady: boolean;
  phase09eApproved: boolean;
  performanceAudit: AuditPerformanceAudit;
}

export type AuditCertificationCheckSeverity = "critical" | "warning" | "info";

export type AuditCertificationCheckCategory =
  | "financial_immutability"
  | "super_admin_visibility"
  | "accounts_restrictions"
  | "manager_isolation"
  | "sr_isolation"
  | "territory_leakage"
  | "audit_completeness"
  | "search_correctness"
  | "architecture"
  | "performance";

export interface AuditCertificationCheckDefinition {
  id: string;
  name: string;
  subsystem: AuditCertificationSubsystem;
  category: AuditCertificationCheckCategory;
  severity: AuditCertificationCheckSeverity;
  ruleNumber?: number;
}

export interface AuditCertificationCheckResult {
  id: string;
  name: string;
  subsystem: AuditCertificationSubsystem;
  category: AuditCertificationCheckCategory;
  severity: AuditCertificationCheckSeverity;
  passed: boolean;
  warning: boolean;
  message: string;
  durationMs: number;
}

export interface AuditCertificationReport {
  result: AuditCertificationResult;
  checks: AuditCertificationCheckResult[];
  remainingRisks: string[];
  requiredManualChecks: string[];
  generatedAt: string;
}
