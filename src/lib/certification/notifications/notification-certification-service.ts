import type {
  NotificationCertificationReport,
  NotificationCertificationResult,
} from "./notification-certification-types";
import { NOTIFICATION_CERTIFICATION_VERSION } from "./notification-certification-types";
import {
  aggregateSubsystemStatuses,
  computeOverallScore,
  runAllNotificationCertificationChecks,
} from "./notification-certification-validation";

/**
 * Enterprise Notification Certification — PHASE_11D.
 *
 * Certifies PHASE_11A–11C without modifying business logic.
 * Read-only verification only.
 *
 * @see ADR-056
 */

export async function buildNotificationCertificationResult(): Promise<{
  result: NotificationCertificationResult;
  checks: Awaited<ReturnType<typeof runAllNotificationCertificationChecks>>["checks"];
}> {
  const { checks, performanceAudit, auditCoverage } =
    await runAllNotificationCertificationChecks();
  const totals = computeOverallScore(checks);
  const subsystems = aggregateSubsystemStatuses(checks);

  const findings = checks
    .filter((check) => !check.passed)
    .map((check) => `${check.id}: ${check.message}`);

  const warnings = checks
    .filter((check) => check.warning)
    .map((check) => `${check.id}: ${check.message}`);

  const risks: string[] = [
    "SMTP deployment requires production SMTP_* env vars and verified connectivity before go-live.",
    "Worker scheduling risk — notifications remain PENDING until process-notifications.ts runs on a schedule.",
    "Scaling risk — PostgreSQL queue is sufficient for current volume; high throughput may need dedicated message broker.",
  ];

  if (auditCoverage.missing.length > 0) {
    risks.push(
      `Notification audit gaps (${auditCoverage.missing.length}): ${auditCoverage.missing.join(", ")}`,
    );
  }
  if (auditCoverage.partial.length > 0) {
    risks.push(
      `Partial notification audit (${auditCoverage.partial.length}): ${auditCoverage.partial.join(", ")}`,
    );
  }
  if (performanceAudit.liveDatabase && !performanceAudit.allWithinTarget) {
    risks.push(
      `Slowest notification path (${performanceAudit.slowestOperation}): ${performanceAudit.slowestDurationMs}ms exceeds certification target`,
    );
  }
  if (!performanceAudit.liveDatabase) {
    risks.push("Live performance audit not executed — DATABASE_URL unavailable");
  }
  if (!performanceAudit.boundedMemorySignals) {
    risks.push("Bounded memory signals not confirmed — large exports may load unbounded rows");
  }

  const criticalFailures = checks.filter(
    (check) => !check.passed && check.severity === "critical",
  ).length;

  const phase11dApproved =
    criticalFailures === 0 &&
    totals.productionReady &&
    subsystems.queueIntegrity.passed &&
    subsystems.providerArchitecture.passed &&
    subsystems.authenticationIntegration.passed &&
    subsystems.financialBoundary.passed &&
    subsystems.architecture.passed &&
    subsystems.notificationSecurity.passed;

  const result: NotificationCertificationResult = {
    certificationVersion: NOTIFICATION_CERTIFICATION_VERSION,
    overallScore: totals.overallScore,
    notificationSecurityScore: subsystems.notificationSecurity.score,
    queueIntegrityScore: subsystems.queueIntegrity.score,
    providerArchitectureScore: subsystems.providerArchitecture.score,
    authenticationIntegrationScore: subsystems.authenticationIntegration.score,
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
    phase11dApproved,
    performanceAudit,
  };

  return { result, checks };
}

export async function runNotificationCertification(): Promise<NotificationCertificationResult> {
  const { result } = await buildNotificationCertificationResult();
  return result;
}

export async function runNotificationCertificationWithReport(): Promise<NotificationCertificationReport> {
  const { buildNotificationCertificationReport } = await import(
    "./notification-certification-report"
  );
  return buildNotificationCertificationReport();
}
