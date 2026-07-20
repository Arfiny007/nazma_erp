export const SR_PERFORMANCE_CERTIFICATION_VERSION = "PHASE_12A.1";

export interface SrPerformanceCertificationCheckResult {
  id: string;
  name: string;
  passed: boolean;
  status: "passed" | "failed" | "warning";
  message: string;
}

export interface SrPerformanceCertificationScores {
  security: number;
  financialAccuracy: number;
  performance: number;
  architecture: number;
  printReadiness: number;
}

export interface SrPerformanceEslintGateEvidence {
  command: string;
  exitCode: number;
  recordedAt: string;
  scope: "repository-wide";
}

export interface SrPerformanceCertificationResult {
  phase: "PHASE_12A.1";
  version: string;
  generatedAt: string;
  checks: SrPerformanceCertificationCheckResult[];
  scores: SrPerformanceCertificationScores;
  warnings: string[];
  manualChecks: string[];
  /** @deprecated Prefer phase12a1Approved — retained for PHASE_12A continuity. */
  phase12aApproved: boolean;
  /** Explicit PHASE_12A.1 corrective-phase approval gate. */
  phase12a1Approved: boolean;
  /** Alias of phase12a1Approved for external certification consumers. */
  approved: boolean;
  productionReady: boolean;
}
