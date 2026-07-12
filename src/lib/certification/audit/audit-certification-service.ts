import type {
  AuditCertificationReport,
  AuditCertificationResult,
} from "./audit-certification-types";
import { AUDIT_CERTIFICATION_VERSION } from "./audit-certification-types";
import {
  aggregateSubsystemStatuses,
  computeOverallScore,
  runAllAuditCertificationChecks,
} from "./audit-certification-validation";

/**
 * Enterprise Audit & Compliance Certification — PHASE_09D.5.
 *
 * Certifies PHASE_09D without modifying business logic.
 * Read-only verification only.
 *
 * @see ADR-047
 */

export async function buildAuditCertificationResult(): Promise<{
  result: AuditCertificationResult;
  checks: Awaited<ReturnType<typeof runAllAuditCertificationChecks>>["checks"];
}> {
  const { checks, performanceAudit, coverage } = await runAllAuditCertificationChecks();
  const totals = computeOverallScore(checks);
  const subsystems = aggregateSubsystemStatuses(checks);

  const findings = checks
    .filter((check) => !check.passed)
    .map((check) => `${check.id}: ${check.message}`);

  const warnings = checks
    .filter((check) => check.warning)
    .map((check) => `${check.id}: ${check.message}`);

  const risks: string[] = [];
  if (coverage.missing.length > 0) {
    risks.push(
      `Audit trail gaps (${coverage.missing.length}): ${coverage.missing.join(", ")}`,
    );
  }
  if (coverage.partial.length > 0) {
    risks.push(
      `Partial audit coverage (${coverage.partial.length}): ${coverage.partial.join(", ")}`,
    );
  }
  if (performanceAudit.liveDatabase && !performanceAudit.allWithinTarget) {
    risks.push(
      `Slowest audit role (${performanceAudit.slowestRole}): ${performanceAudit.slowestDurationMs}ms exceeds 1000ms target`,
    );
  }
  if (!performanceAudit.liveDatabase) {
    risks.push("Live performance audit not executed — DATABASE_URL or demo seed unavailable");
  }

  const criticalFailures = checks.filter(
    (check) => !check.passed && check.severity === "critical",
  ).length;

  const phase09eApproved =
    criticalFailures === 0 &&
    totals.productionReady &&
    subsystems.security.passed &&
    subsystems.financialIntegrity.passed &&
    subsystems.territoryIsolation.passed &&
    subsystems.architecture.passed;

  const result: AuditCertificationResult = {
    certificationVersion: AUDIT_CERTIFICATION_VERSION,
    overallScore: totals.overallScore,
    securityScore: subsystems.security.score,
    financialIntegrityScore: subsystems.financialIntegrity.score,
    territoryIsolationScore: subsystems.territoryIsolation.score,
    auditCoverageScore: subsystems.auditCoverage.score,
    architectureScore: subsystems.architecture.score,
    performanceScore: subsystems.performance.score,
    passedChecks: totals.passedChecks,
    failedChecks: totals.failedChecks,
    warningCount: totals.warningCount,
    subsystems,
    coverage,
    findings,
    warnings,
    risks,
    productionReady: totals.productionReady,
    phase09eApproved,
    performanceAudit,
  };

  return { result, checks };
}

export async function runAuditCertification(): Promise<AuditCertificationResult> {
  const { result } = await buildAuditCertificationResult();
  return result;
}

export async function runAuditCertificationWithReport(): Promise<AuditCertificationReport> {
  const { buildAuditCertificationReport } = await import("./audit-certification-report");
  return buildAuditCertificationReport();
}
