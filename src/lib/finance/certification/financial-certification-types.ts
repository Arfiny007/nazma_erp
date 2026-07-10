/**
 * Types for the Enterprise Financial System Certification — PHASE_07F.
 *
 * Orchestrates read-only verification across every financial subsystem.
 * Never mutates financial data.
 *
 * @see ADR-037
 */

/** Certification version — bump when check catalog changes materially. */
export const FINANCIAL_CERTIFICATION_VERSION = "1.0.0";

/** Minimum overall score required for production readiness. */
export const PRODUCTION_READINESS_THRESHOLD = 9.0;

/** Subsystem keys audited by `runFinancialCertification()`. */
export type CertificationSubsystem =
  | "ledger"
  | "posting"
  | "openingBalance"
  | "statement"
  | "replay"
  | "reconciliation"
  | "integrityMonitor"
  | "audit";

/** Per-subsystem certification outcome. */
export interface CertificationStatus {
  score: number;
  passed: boolean;
  passedChecks: number;
  failedChecks: number;
  warnings: number;
}

/** Result returned by `runFinancialCertification()`. */
export interface FinancialCertificationResult {
  certificationVersion: string;
  overallScore: number;
  passedChecks: number;
  failedChecks: number;
  warnings: number;
  subsystems: Record<CertificationSubsystem, CertificationStatus>;
  productionReady: boolean;
}

/** Individual check severity. */
export type CertificationCheckSeverity = "critical" | "warning" | "info";

/** Check category for reporting. */
export type CertificationCheckCategory =
  | "ledger_correctness"
  | "financial_integrity"
  | "accounting_sensitivity"
  | "replay_safety"
  | "reconciliation_accuracy"
  | "statement_correctness"
  | "opening_balance"
  | "concurrency"
  | "idempotency"
  | "audit_traceability"
  | "immutability"
  | "performance"
  | "repository_boundary";

/** Definition of a certification check. */
export interface CertificationCheckDefinition {
  id: string;
  name: string;
  subsystem: CertificationSubsystem;
  category: CertificationCheckCategory;
  severity: CertificationCheckSeverity;
}

/** Outcome of a single certification check. */
export interface CertificationCheckResult {
  id: string;
  name: string;
  subsystem: CertificationSubsystem;
  category: CertificationCheckCategory;
  severity: CertificationCheckSeverity;
  passed: boolean;
  warning: boolean;
  message: string;
  durationMs: number;
}

/** Internal context passed through the certification runner. */
export interface CertificationRunContext {
  databaseAvailable: boolean;
  startedAt: Date;
}

/** Performance measurement snapshot — measure only, never optimize. */
export interface CertificationPerformanceSnapshot {
  dealerCount: number;
  ledgerRowCount: number;
  reconciliationDurationMs: number;
  statementSampleDurationMs: number | null;
}

/** Full certification report with check details and risk summary. */
export interface FinancialCertificationReport {
  result: FinancialCertificationResult;
  checks: CertificationCheckResult[];
  performance: CertificationPerformanceSnapshot | null;
  remainingRisks: string[];
  requiredManualChecks: string[];
  generatedAt: string;
}
