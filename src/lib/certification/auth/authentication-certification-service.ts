import type {
  AuthenticationCertificationReport,
  AuthenticationCertificationResult,
} from "./authentication-certification-types";
import { AUTHENTICATION_CERTIFICATION_VERSION } from "./authentication-certification-types";
import {
  aggregateSubsystemStatuses,
  computeOverallScore,
  runAllAuthenticationCertificationChecks,
} from "./authentication-certification-validation";

/**
 * Enterprise Authentication Certification — PHASE_10D.
 *
 * Certifies PHASE_10C without modifying business logic.
 * Read-only verification only.
 *
 * @see ADR-052
 */

export async function buildAuthenticationCertificationResult(): Promise<{
  result: AuthenticationCertificationResult;
  checks: Awaited<
    ReturnType<typeof runAllAuthenticationCertificationChecks>
  >["checks"];
}> {
  const { checks, performanceAudit, auditCoverage } =
    await runAllAuthenticationCertificationChecks();
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
      `Authentication audit gaps (${auditCoverage.missing.length}): ${auditCoverage.missing.join(", ")}`,
    );
  }
  if (auditCoverage.partial.length > 0) {
    risks.push(
      `Partial authentication audit (${auditCoverage.partial.length}): ${auditCoverage.partial.join(", ")}`,
    );
  }
  if (performanceAudit.liveDatabase && !performanceAudit.allWithinTarget) {
    risks.push(
      `Slowest auth path (${performanceAudit.slowestOperation}): ${performanceAudit.slowestDurationMs}ms exceeds 1000ms target`,
    );
  }
  if (!performanceAudit.liveDatabase) {
    risks.push("Live performance audit not executed — DATABASE_URL unavailable");
  }
  risks.push("Email/SMS delivery not implemented — activation/reset links manual only");

  const criticalFailures = checks.filter(
    (check) => !check.passed && check.severity === "critical",
  ).length;

  const phase10dApproved =
    criticalFailures === 0 &&
    totals.productionReady &&
    subsystems.passwordSecurity.passed &&
    subsystems.tokenSecurity.passed &&
    subsystems.sessionSecurity.passed &&
    subsystems.financialBoundary.passed &&
    subsystems.architecture.passed;

  const result: AuthenticationCertificationResult = {
    certificationVersion: AUTHENTICATION_CERTIFICATION_VERSION,
    overallScore: totals.overallScore,
    securityScore: subsystems.security.score,
    passwordSecurityScore: subsystems.passwordSecurity.score,
    tokenSecurityScore: subsystems.tokenSecurity.score,
    sessionSecurityScore: subsystems.sessionSecurity.score,
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
    phase10dApproved,
    performanceAudit,
  };

  return { result, checks };
}

export async function runAuthenticationCertification(): Promise<AuthenticationCertificationResult> {
  const { result } = await buildAuthenticationCertificationResult();
  return result;
}

export async function runAuthenticationCertificationWithReport(): Promise<AuthenticationCertificationReport> {
  const { buildAuthenticationCertificationReport } = await import(
    "./authentication-certification-report"
  );
  return buildAuthenticationCertificationReport();
}
