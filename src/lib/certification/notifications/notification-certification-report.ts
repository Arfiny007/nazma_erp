import type {
  NotificationCertificationCheckResult,
  NotificationCertificationReport,
  NotificationCertificationResult,
  NotificationCertificationStatus,
  NotificationCertificationSubsystem,
} from "./notification-certification-types";
import { buildNotificationCertificationResult } from "./notification-certification-service";

/**
 * Human-readable Notification Certification Report — PHASE_11D.
 *
 * @see ADR-056
 */

const REMAINING_RISKS = [
  "Production SMTP requires SMTP_* env vars and outbound network access from worker container.",
  "Worker must be scheduled (cron/orchestrator) — queue does not self-drain without process-notifications.ts.",
  "Console provider is default when SMTP is not configured — emails are log-only until SMTP is set.",
  "SMS / push / in-app notification center remain out of scope.",
  "High-volume campaigns may require dedicated message broker beyond PostgreSQL queue.",
];

const REQUIRED_MANUAL_CHECKS = [
  "Provision PENDING_ACTIVATION user — confirm activation notification appears in /settings/notifications.",
  "Run `npm run process-notifications` — confirm notification transitions to SENT.",
  "Configure SMTP_* in staging — verify provider health on /settings/notifications.",
  "Request password reset — confirm NOTIFICATION_CREATED audit and queued delivery.",
  "Attempt resend as non–Super_Admin — confirm forbidden.",
  "Disable user — confirm activation/reset resend rejected.",
  "Run `npx vitest run src/lib/certification/notifications` after notification layer changes.",
];

const SUBSYSTEM_LABELS: Record<NotificationCertificationSubsystem, string> = {
  notificationSecurity: "Notification Security",
  queueIntegrity: "Queue Integrity",
  providerArchitecture: "Provider Architecture",
  authenticationIntegration: "Authentication Integration",
  auditCoverage: "Audit Trail Completeness",
  financialBoundary: "Financial Boundary",
  architecture: "Architectural Boundaries",
  performance: "Performance Audit",
};

export async function buildNotificationCertificationReport(): Promise<NotificationCertificationReport> {
  const { result, checks } = await buildNotificationCertificationResult();

  return {
    result,
    checks,
    remainingRisks: deriveRemainingRisks(result, checks),
    requiredManualChecks: REQUIRED_MANUAL_CHECKS,
    generatedAt: new Date().toISOString(),
  };
}

function deriveRemainingRisks(
  result: NotificationCertificationResult,
  checks: NotificationCertificationCheckResult[],
): string[] {
  const risks = [...REMAINING_RISKS, ...result.risks];

  for (const check of checks.filter((item) => !item.passed)) {
    risks.unshift(`FAILED: ${check.name} — ${check.message}`);
  }

  for (const check of checks.filter((item) => item.warning)) {
    risks.push(`WARNING: ${check.name} — ${check.message}`);
  }

  if (!result.productionReady) {
    risks.unshift(
      `Overall certification score ${result.overallScore}/10 is below production threshold.`,
    );
  }

  return risks;
}

export function formatNotificationSubsystemScoreLine(
  subsystem: NotificationCertificationSubsystem,
  status: NotificationCertificationStatus,
): string {
  const label = SUBSYSTEM_LABELS[subsystem];
  const flag = status.passed ? "PASS" : "REVIEW";
  return `${label}: ${status.score}/10 (${flag}) — ${status.passedChecks} passed, ${status.failedChecks} failed, ${status.warnings} warnings`;
}

export function formatNotificationCertificationSummaryLine(
  result: NotificationCertificationResult,
): string {
  const ready = result.productionReady ? "YES" : "NO";
  const phase11d = result.phase11dApproved ? "APPROVED" : "BLOCKED";
  return `Notification Certification ${result.certificationVersion}: ${result.overallScore}/10 — Production Ready: ${ready} — PHASE_11D: ${phase11d} (${result.passedChecks} passed, ${result.failedChecks} failed, ${result.warningCount} warnings)`;
}

export function buildNotificationCertificationExecutiveSummary(
  report: NotificationCertificationReport,
): string[] {
  const lines: string[] = [
    "═".repeat(72),
    "NAZMA ERP — ENTERPRISE NOTIFICATION CERTIFICATION (PHASE_11D)",
    "═".repeat(72),
    formatNotificationCertificationSummaryLine(report.result),
    "",
    "Subsystem Scores",
    "─".repeat(40),
    `Notification Security:      ${report.result.notificationSecurityScore}/10`,
    `Queue Integrity:            ${report.result.queueIntegrityScore}/10`,
    `Provider Architecture:      ${report.result.providerArchitectureScore}/10`,
    `Authentication Integration: ${report.result.authenticationIntegrationScore}/10`,
    `Audit Coverage:             ${report.result.auditCoverageScore}/10`,
    `Financial Boundary:         ${report.result.financialBoundaryScore}/10`,
    `Architecture:               ${report.result.architectureScore}/10`,
    `Performance:                ${report.result.performanceScore}/10`,
    "",
  ];

  for (const subsystem of Object.keys(
    report.result.subsystems,
  ) as NotificationCertificationSubsystem[]) {
    lines.push(
      formatNotificationSubsystemScoreLine(subsystem, report.result.subsystems[subsystem]),
    );
  }

  lines.push("", "Notification Audit Coverage", "─".repeat(40));
  lines.push(
    `  Covered (${report.result.auditCoverage.covered.length}): ${report.result.auditCoverage.covered.join(", ") || "none"}`,
  );
  lines.push(
    `  Partial (${report.result.auditCoverage.partial.length}): ${report.result.auditCoverage.partial.join(", ") || "none"}`,
  );
  lines.push(
    `  Missing (${report.result.auditCoverage.missing.length}): ${report.result.auditCoverage.missing.join(", ") || "none"}`,
  );

  if (report.result.performanceAudit.measurements.length > 0) {
    lines.push("", "Performance Audit", "─".repeat(40));
    for (const measurement of report.result.performanceAudit.measurements) {
      lines.push(
        `  ${measurement.operation}/${measurement.path}: ${measurement.durationMs}ms (${measurement.recordCount} records) ${measurement.withinTarget ? "✓" : "⚠"}`,
      );
    }
    lines.push(
      `  Slowest: ${report.result.performanceAudit.slowestOperation} (${report.result.performanceAudit.slowestDurationMs}ms)`,
    );
    lines.push(
      `  Query surface: ${report.result.performanceAudit.estimatedQuerySurface} Prisma call sites`,
    );
    lines.push(
      `  Bounded memory: ${report.result.performanceAudit.boundedMemorySignals ? "yes" : "no"}`,
    );
  }

  if (report.remainingRisks.length > 0) {
    lines.push("", "Remaining Risks", "─".repeat(40));
    for (const risk of report.remainingRisks.slice(0, 12)) {
      lines.push(`  • ${risk}`);
    }
  }

  lines.push("", "═".repeat(72));
  return lines;
}
