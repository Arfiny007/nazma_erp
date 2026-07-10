import type {
  FinancialCertificationReport,
  FinancialCertificationResult,
} from "./financial-certification-types";
import { FINANCIAL_CERTIFICATION_VERSION } from "./financial-certification-types";
import {
  aggregateSubsystemStatuses,
  computeOverallScore,
  resolveDatabaseAvailability,
  runAllCertificationChecks,
  verifyIntegrityMonitorOrchestration,
} from "./financial-certification-validation";

/**
 * Enterprise Financial System Certification — PHASE_07F.
 *
 * Proves the entire accounting system behaves correctly under real-world ERP
 * conditions. Read-only — never mutates financial data.
 *
 * @see ADR-037
 */

/** Build the certification result from executed checks. */
export async function buildFinancialCertificationResult(): Promise<{
  result: FinancialCertificationResult;
  checks: Awaited<ReturnType<typeof runAllCertificationChecks>>["checks"];
  performance: Awaited<ReturnType<typeof runAllCertificationChecks>>["performance"];
}> {
  const ctx = {
    databaseAvailable: await resolveDatabaseAvailability(),
    startedAt: new Date(),
  };

  const { checks, performance } = await runAllCertificationChecks(ctx);

  const orchestrationCheck = await verifyIntegrityMonitorOrchestration(ctx);
  if (orchestrationCheck) {
    checks.push(orchestrationCheck);
  }

  const totals = computeOverallScore(checks);
  const subsystems = aggregateSubsystemStatuses(checks);

  const result: FinancialCertificationResult = {
    certificationVersion: FINANCIAL_CERTIFICATION_VERSION,
    overallScore: totals.overallScore,
    passedChecks: totals.passedChecks,
    failedChecks: totals.failedChecks,
    warnings: totals.warnings,
    subsystems,
    productionReady: totals.productionReady,
  };

  return { result, checks, performance };
}

/**
 * Run the full enterprise financial certification suite.
 *
 * Audits ledger correctness, posting boundaries, opening balance,
 * statement engine, replay safety, reconciliation, integrity monitor,
 * and audit traceability.
 */
export async function runFinancialCertification(): Promise<FinancialCertificationResult> {
  const { result } = await buildFinancialCertificationResult();
  return result;
}

/**
 * Run certification and return the full report with check details,
 * performance measurements, remaining risks, and manual check list.
 */
export async function runFinancialCertificationWithReport(): Promise<FinancialCertificationReport> {
  const { buildFinancialCertificationReport } = await import(
    "./financial-certification-report"
  );
  return buildFinancialCertificationReport();
}