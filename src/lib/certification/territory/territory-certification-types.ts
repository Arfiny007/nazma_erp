/**
 * Types for Enterprise Territory & Due Certification — PHASE_08E.
 *
 * Read-only verification across PHASE_08A–08D subsystems.
 * Never mutates financial or organizational data.
 *
 * @see ADR-041
 */

/** Certification version — bump when check catalog changes materially. */
export const TERRITORY_CERTIFICATION_VERSION = "1.0.0";

/** Minimum overall score required for production readiness. */
export const TERRITORY_PRODUCTION_READINESS_THRESHOLD = 9.0;

/** Subsystem keys audited by `runTerritoryCertification()`. */
export type TerritoryCertificationSubsystem =
  | "territorySecurity"
  | "ownershipIntegrity"
  | "dueAccuracy"
  | "financialBoundary";

/** Per-subsystem certification outcome. */
export interface TerritoryCertificationStatus {
  score: number;
  passed: boolean;
  passedChecks: number;
  failedChecks: number;
  warnings: number;
}

/** Result returned by `runTerritoryCertification()`. */
export interface TerritoryCertificationResult {
  certificationVersion: string;
  overallScore: number;
  passedChecks: number;
  failedChecks: number;
  warnings: number;
  subsystems: Record<TerritoryCertificationSubsystem, TerritoryCertificationStatus>;
  territorySecurityScore: number;
  ownershipIntegrityScore: number;
  dueAccuracyScore: number;
  financialBoundaryScore: number;
  productionReady: boolean;
}

export type TerritoryCertificationCheckSeverity = "critical" | "warning" | "info";

export type TerritoryCertificationCheckCategory =
  | "territory_rbac"
  | "ownership_history"
  | "due_reporting"
  | "aging_accuracy"
  | "financial_boundary"
  | "repository_boundary"
  | "historical_attribution"
  | "performance";

/** Definition of a certification check. */
export interface TerritoryCertificationCheckDefinition {
  id: string;
  name: string;
  subsystem: TerritoryCertificationSubsystem;
  category: TerritoryCertificationCheckCategory;
  severity: TerritoryCertificationCheckSeverity;
  ruleNumber?: number;
}

/** Outcome of a single certification check. */
export interface TerritoryCertificationCheckResult {
  id: string;
  name: string;
  subsystem: TerritoryCertificationSubsystem;
  category: TerritoryCertificationCheckCategory;
  severity: TerritoryCertificationCheckSeverity;
  passed: boolean;
  warning: boolean;
  message: string;
  durationMs: number;
}

/** Internal context passed through the certification runner. */
export interface TerritoryCertificationRunContext {
  databaseAvailable: boolean;
  startedAt: Date;
}

/** Aging vs balance reconciliation for Rule 7. */
export interface AgingBalanceReconciliation {
  dealerCode: string;
  dealerBalance: string;
  totalInvoiceAging: string;
  delta: string;
  explainedBy: readonly (
    | "opening_balance"
    | "unallocated_collections"
    | "advance_payment"
    | "unexplained"
  )[];
}

/** Full certification report with check details and risk summary. */
export interface TerritoryCertificationReport {
  result: TerritoryCertificationResult;
  checks: TerritoryCertificationCheckResult[];
  agingReconciliations: AgingBalanceReconciliation[];
  remainingRisks: string[];
  requiredManualChecks: string[];
  generatedAt: string;
}
