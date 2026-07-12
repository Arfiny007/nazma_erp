import type {
  DashboardCertificationReport,
  DashboardCertificationResult,
} from "./dashboard-certification-types";
import { DASHBOARD_CERTIFICATION_VERSION } from "./dashboard-certification-types";
import {
  aggregateSubsystemStatuses,
  computeOverallScore,
  runAllDashboardCertificationChecks,
} from "./dashboard-certification-validation";

/**
 * Enterprise Dashboard Certification — PHASE_09A.5.
 *
 * Certifies PHASE_09A without modifying business logic.
 * Read-only verification only.
 *
 * @see ADR-043
 */

export async function buildDashboardCertificationResult(): Promise<{
  result: DashboardCertificationResult;
  checks: Awaited<ReturnType<typeof runAllDashboardCertificationChecks>>["checks"];
}> {
  const { checks, performanceAudit } = await runAllDashboardCertificationChecks();
  const totals = computeOverallScore(checks);
  const subsystems = aggregateSubsystemStatuses(checks);

  const findings = checks
    .filter((check) => !check.passed)
    .map((check) => `${check.id}: ${check.message}`);

  const warnings = checks
    .filter((check) => check.warning)
    .map((check) => `${check.id}: ${check.message}`);

  const risks: string[] = [];
  if (performanceAudit.liveDatabase && !performanceAudit.allWithinTarget) {
    risks.push(
      `Slowest dashboard role (${performanceAudit.slowestRole}): ${performanceAudit.slowestDurationMs}ms exceeds 1000ms target`,
    );
  }
  if (!performanceAudit.liveDatabase) {
    risks.push("Live performance audit not executed — DATABASE_URL or demo seed unavailable");
  }
  if (performanceAudit.largestPayloadBytes > 100_000) {
    risks.push(
      `Large dashboard payload detected: ${performanceAudit.largestPayloadBytes} bytes — monitor before adding charts`,
    );
  }

  const criticalFailures = checks.filter(
    (check) => !check.passed && check.severity === "critical",
  ).length;

  const phase09bApproved =
    criticalFailures === 0 &&
    totals.productionReady &&
    subsystems.security.passed &&
    subsystems.financial.passed &&
    subsystems.architecture.passed;

  const result: DashboardCertificationResult = {
    certificationVersion: DASHBOARD_CERTIFICATION_VERSION,
    overallScore: totals.overallScore,
    securityScore: subsystems.security.score,
    financialScore: subsystems.financial.score,
    performanceScore: subsystems.performance.score,
    architectureScore: subsystems.architecture.score,
    passedChecks: totals.passedChecks,
    failedChecks: totals.failedChecks,
    warningCount: totals.warningCount,
    subsystems,
    findings,
    warnings,
    risks,
    productionReady: totals.productionReady,
    phase09bApproved,
    performanceAudit,
  };

  return { result, checks };
}

/**
 * Run the full enterprise dashboard certification suite.
 */
export async function runDashboardCertification(): Promise<DashboardCertificationResult> {
  const { result } = await buildDashboardCertificationResult();
  return result;
}

/**
 * Run certification and return the full report with check details,
 * performance audit, remaining risks, and manual check list.
 */
export async function runDashboardCertificationWithReport(): Promise<DashboardCertificationReport> {
  const { buildDashboardCertificationReport } = await import(
    "./dashboard-certification-report"
  );
  return buildDashboardCertificationReport();
}
