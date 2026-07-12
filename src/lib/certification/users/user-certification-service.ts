import type {
  UserCertificationReport,
  UserCertificationResult,
} from "./user-certification-types";
import { USER_CERTIFICATION_VERSION } from "./user-certification-types";
import {
  aggregateSubsystemStatuses,
  computeOverallScore,
  runAllUserCertificationChecks,
} from "./user-certification-validation";

/**
 * Enterprise User Management Certification — PHASE_10B.
 *
 * Certifies PHASE_10A without modifying business logic.
 * Read-only verification only.
 *
 * @see ADR-050
 */

export async function buildUserCertificationResult(): Promise<{
  result: UserCertificationResult;
  checks: Awaited<ReturnType<typeof runAllUserCertificationChecks>>["checks"];
}> {
  const { checks, performanceAudit, auditCoverage } = await runAllUserCertificationChecks();
  const totals = computeOverallScore(checks);
  const subsystems = aggregateSubsystemStatuses(checks);

  const findings = checks
    .filter((check) => !check.passed)
    .map((check) => `${check.id}: ${check.message}`);

  const warnings = checks
    .filter((check) => check.warning)
    .map((check) => `${check.id}: ${check.message}`);

  const risks: string[] = [];
  if (auditCoverage.missing.length > 0) {
    risks.push(
      `User audit gaps (${auditCoverage.missing.length}): ${auditCoverage.missing.join(", ")}`,
    );
  }
  if (auditCoverage.partial.length > 0) {
    risks.push(
      `Partial user audit metadata (${auditCoverage.partial.length}): ${auditCoverage.partial.join(", ")}`,
    );
  }
  if (performanceAudit.liveDatabase && !performanceAudit.allWithinTarget) {
    risks.push(
      `Slowest user operation (${performanceAudit.slowestOperation}): ${performanceAudit.slowestDurationMs}ms exceeds 1000ms target`,
    );
  }
  if (!performanceAudit.liveDatabase) {
    risks.push("Live performance audit not executed — DATABASE_URL or demo seed unavailable");
  }

  const criticalFailures = checks.filter(
    (check) => !check.passed && check.severity === "critical",
  ).length;

  const phase10cApproved =
    criticalFailures === 0 &&
    totals.productionReady &&
    subsystems.security.passed &&
    subsystems.territoryIsolation.passed &&
    subsystems.lifecycle.passed &&
    subsystems.financialBoundary.passed &&
    subsystems.architecture.passed;

  const result: UserCertificationResult = {
    certificationVersion: USER_CERTIFICATION_VERSION,
    overallScore: totals.overallScore,
    securityScore: subsystems.security.score,
    territoryIsolationScore: subsystems.territoryIsolation.score,
    lifecycleScore: subsystems.lifecycle.score,
    auditCoverageScore: subsystems.auditCoverage.score,
    financialBoundaryScore: subsystems.financialBoundary.score,
    architectureScore: subsystems.architecture.score,
    performanceScore: subsystems.performance.score,
    passedChecks: totals.passedChecks,
    failedChecks: totals.failedChecks,
    warningCount: totals.warningCount,
    subsystems,
    auditCoverage,
    findings,
    warnings,
    risks,
    productionReady: totals.productionReady,
    phase10cApproved,
    performanceAudit,
  };

  return { result, checks };
}

export async function runUserCertification(): Promise<UserCertificationResult> {
  const { result } = await buildUserCertificationResult();
  return result;
}

export async function runUserCertificationWithReport(): Promise<UserCertificationReport> {
  const { buildUserCertificationReport } = await import("./user-certification-report");
  return buildUserCertificationReport();
}
