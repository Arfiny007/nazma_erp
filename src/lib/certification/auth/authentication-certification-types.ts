/**
 * Types for Enterprise Authentication Certification — PHASE_10D.
 *
 * Read-only verification across PHASE_10C authentication layer.
 * Never mutates financial or organizational data.
 *
 * @see ADR-052
 */

export const AUTHENTICATION_CERTIFICATION_VERSION = "1.0.0";

export const AUTH_PRODUCTION_READINESS_THRESHOLD = 9.0;

export const AUTH_PERFORMANCE_TARGET_MS = 1000;

export type AuthenticationCertificationSubsystem =
  | "security"
  | "passwordSecurity"
  | "tokenSecurity"
  | "sessionSecurity"
  | "auditCoverage"
  | "financialBoundary"
  | "architecture"
  | "performance";

export interface AuthenticationCertificationStatus {
  score: number;
  passed: boolean;
  passedChecks: number;
  failedChecks: number;
  warnings: number;
}

/** Authentication audit trail coverage — Rule 8. */
export interface AuthenticationAuditCoverageReport {
  covered: string[];
  missing: string[];
  partial: string[];
}

export interface AuthenticationPerformanceMeasurement {
  operation: "login" | "activation" | "reset" | "middleware";
  path: string;
  durationMs: number;
  queryCountEstimate: number;
  withinTarget: boolean;
}

export interface AuthenticationPerformanceAudit {
  measurements: AuthenticationPerformanceMeasurement[];
  slowestOperation: AuthenticationPerformanceMeasurement["operation"] | null;
  slowestDurationMs: number;
  estimatedQuerySurface: number;
  allWithinTarget: boolean;
  liveDatabase: boolean;
}

export interface AuthenticationCertificationResult {
  certificationVersion: string;
  overallScore: number;
  securityScore: number;
  passwordSecurityScore: number;
  tokenSecurityScore: number;
  sessionSecurityScore: number;
  auditCoverageScore: number;
  financialBoundaryScore: number;
  architectureScore: number;
  performanceScore: number;
  passedChecks: number;
  failedChecks: number;
  warningCount: number;
  subsystems: Record<AuthenticationCertificationSubsystem, AuthenticationCertificationStatus>;
  auditCoverage: AuthenticationAuditCoverageReport;
  findings: string[];
  warnings: string[];
  risks: string[];
  productionReady: boolean;
  phase10dApproved: boolean;
  performanceAudit: AuthenticationPerformanceAudit;
}

export type AuthenticationCertificationCheckSeverity = "critical" | "warning" | "info";

export type AuthenticationCertificationCheckCategory =
  | "password_security"
  | "token_security"
  | "must_change_password"
  | "activation_flow"
  | "password_reset"
  | "role_login_matrix"
  | "privilege_escalation"
  | "audit_completeness"
  | "financial_boundary"
  | "architecture"
  | "performance"
  | "session_security";

export interface AuthenticationCertificationCheckDefinition {
  id: string;
  name: string;
  subsystem: AuthenticationCertificationSubsystem;
  category: AuthenticationCertificationCheckCategory;
  severity: AuthenticationCertificationCheckSeverity;
  ruleNumber?: number;
}

export interface AuthenticationCertificationCheckResult {
  id: string;
  name: string;
  subsystem: AuthenticationCertificationSubsystem;
  category: AuthenticationCertificationCheckCategory;
  severity: AuthenticationCertificationCheckSeverity;
  passed: boolean;
  warning: boolean;
  message: string;
  durationMs: number;
}

export interface AuthenticationCertificationReport {
  result: AuthenticationCertificationResult;
  checks: AuthenticationCertificationCheckResult[];
  remainingRisks: string[];
  requiredManualChecks: string[];
  generatedAt: string;
}
