/**
 * Types for Enterprise Notification Certification — PHASE_11D.
 *
 * Read-only verification across PHASE_11A–11C notification layer.
 * Never mutates financial or organizational data.
 *
 * @see ADR-056
 */

export const NOTIFICATION_CERTIFICATION_VERSION = "1.0.0";

export const NOTIFICATION_PRODUCTION_READINESS_THRESHOLD = 9.0;

export const NOTIFICATION_PERFORMANCE_TARGET_100_MS = 1000;
export const NOTIFICATION_PERFORMANCE_TARGET_1000_MS = 5000;

export type NotificationCertificationSubsystem =
  | "notificationSecurity"
  | "queueIntegrity"
  | "providerArchitecture"
  | "authenticationIntegration"
  | "auditCoverage"
  | "financialBoundary"
  | "architecture"
  | "performance";

export interface NotificationCertificationStatus {
  score: number;
  passed: boolean;
  passedChecks: number;
  failedChecks: number;
  warnings: number;
}

/** Notification audit trail coverage — Rule 10. */
export interface NotificationAuditCoverageReport {
  covered: string[];
  missing: string[];
  partial: string[];
}

export interface NotificationPerformanceMeasurement {
  operation: "queueProcessing" | "search" | "export";
  path: string;
  durationMs: number;
  recordCount: number;
  withinTarget: boolean;
  structuralOnly: boolean;
}

export interface NotificationPerformanceAudit {
  measurements: NotificationPerformanceMeasurement[];
  slowestOperation: NotificationPerformanceMeasurement["operation"] | null;
  slowestDurationMs: number;
  estimatedQuerySurface: number;
  allWithinTarget: boolean;
  liveDatabase: boolean;
  boundedMemorySignals: boolean;
}

export interface NotificationCertificationResult {
  certificationVersion: string;
  overallScore: number;
  notificationSecurityScore: number;
  queueIntegrityScore: number;
  providerArchitectureScore: number;
  authenticationIntegrationScore: number;
  auditCoverageScore: number;
  financialBoundaryScore: number;
  architectureScore: number;
  performanceScore: number;
  passedChecks: number;
  failedChecks: number;
  warningCount: number;
  subsystems: Record<NotificationCertificationSubsystem, NotificationCertificationStatus>;
  auditCoverage: NotificationAuditCoverageReport;
  findings: string[];
  warnings: string[];
  risks: string[];
  productionReady: boolean;
  phase11dApproved: boolean;
  performanceAudit: NotificationPerformanceAudit;
}

export type NotificationCertificationCheckSeverity = "critical" | "warning" | "info";

export type NotificationCertificationCheckCategory =
  | "immutability"
  | "queue_integrity"
  | "retry_policy"
  | "provider_isolation"
  | "auth_integration"
  | "notification_security"
  | "queue_safety"
  | "smtp_abstraction"
  | "financial_boundary"
  | "audit_completeness"
  | "architecture"
  | "performance";

export interface NotificationCertificationCheckDefinition {
  id: string;
  name: string;
  subsystem: NotificationCertificationSubsystem;
  category: NotificationCertificationCheckCategory;
  severity: NotificationCertificationCheckSeverity;
  ruleNumber?: number;
}

export interface NotificationCertificationCheckResult {
  id: string;
  name: string;
  subsystem: NotificationCertificationSubsystem;
  category: NotificationCertificationCheckCategory;
  severity: NotificationCertificationCheckSeverity;
  passed: boolean;
  warning: boolean;
  message: string;
  durationMs: number;
}

export interface NotificationCertificationReport {
  result: NotificationCertificationResult;
  checks: NotificationCertificationCheckResult[];
  remainingRisks: string[];
  requiredManualChecks: string[];
  generatedAt: string;
}
