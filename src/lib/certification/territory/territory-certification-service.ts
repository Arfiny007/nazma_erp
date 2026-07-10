import type {
  TerritoryCertificationReport,
  TerritoryCertificationResult,
} from "./territory-certification-types";
import { TERRITORY_CERTIFICATION_VERSION } from "./territory-certification-types";
import {
  aggregateSubsystemStatuses,
  computeOverallScore,
  resolveDatabaseAvailability,
  runAllTerritoryCertificationChecks,
} from "./territory-certification-validation";

/**
 * Enterprise Territory & Due Certification — PHASE_08E.
 *
 * Certifies PHASE_08A–08D without modifying business logic.
 * Read-only verification only.
 *
 * @see ADR-041
 */

export async function buildTerritoryCertificationResult(): Promise<{
  result: TerritoryCertificationResult;
  checks: Awaited<ReturnType<typeof runAllTerritoryCertificationChecks>>["checks"];
  agingReconciliations: Awaited<
    ReturnType<typeof runAllTerritoryCertificationChecks>
  >["agingReconciliations"];
}> {
  const ctx = {
    databaseAvailable: await resolveDatabaseAvailability(),
    startedAt: new Date(),
  };
  void ctx;

  const { checks, agingReconciliations } =
    await runAllTerritoryCertificationChecks();

  const totals = computeOverallScore(checks);
  const subsystems = aggregateSubsystemStatuses(checks);

  const result: TerritoryCertificationResult = {
    certificationVersion: TERRITORY_CERTIFICATION_VERSION,
    overallScore: totals.overallScore,
    passedChecks: totals.passedChecks,
    failedChecks: totals.failedChecks,
    warnings: totals.warnings,
    subsystems,
    territorySecurityScore: subsystems.territorySecurity.score,
    ownershipIntegrityScore: subsystems.ownershipIntegrity.score,
    dueAccuracyScore: subsystems.dueAccuracy.score,
    financialBoundaryScore: subsystems.financialBoundary.score,
    productionReady: totals.productionReady,
  };

  return { result, checks, agingReconciliations };
}

/**
 * Run the full enterprise territory & due certification suite.
 */
export async function runTerritoryCertification(): Promise<TerritoryCertificationResult> {
  const { result } = await buildTerritoryCertificationResult();
  return result;
}

/**
 * Run certification and return the full report with check details,
 * aging reconciliations, remaining risks, and manual check list.
 */
export async function runTerritoryCertificationWithReport(): Promise<TerritoryCertificationReport> {
  const { buildTerritoryCertificationReport } = await import(
    "./territory-certification-report"
  );
  return buildTerritoryCertificationReport();
}
