import type {
  DashboardCertificationCheckResult,
  DashboardCertificationReport,
  DashboardCertificationResult,
  DashboardCertificationStatus,
  DashboardCertificationSubsystem,
} from "./dashboard-certification-types";
import { buildDashboardCertificationResult } from "./dashboard-certification-service";

/**
 * Human-readable Dashboard Certification Report — PHASE_09A.5.
 *
 * @see ADR-043
 */

const REMAINING_RISKS = [
  "Accounts/Admin dashboards invoke reconcileAllDealers() on every load — may exceed 1000ms at scale (optimization deferred to PHASE_09B).",
  "Invoice/collection sales KPIs are operational Prisma aggregates — distinct from due authority (Dealer.currentBalance).",
  "Live performance audit requires demo seed users (sr1@nazma.test, etc.) and DATABASE_URL.",
  "Granular per-query Prisma profiling requires middleware — certification uses structural query surface count.",
];

const REQUIRED_MANUAL_CHECKS = [
  "Log in as SR (sr1@nazma.test) and confirm dashboard dealers match assigned territories.",
  "Log in as Manager (manager1@nazma.test) and confirm SR leaderboard excludes foreign territories.",
  "Log in as Accounts and verify Total Due matches /reports/due company summary.",
  "Log in as Super Admin and verify company KPIs match global aggregates.",
  "Compare dashboard Outstanding Due KPI against getCompanyDueSummary() for a sample scope.",
  "Run `npx vitest run` with DATABASE_URL for live performance audit.",
];

const SUBSYSTEM_LABELS: Record<DashboardCertificationSubsystem, string> = {
  security: "Dashboard Security (Territory Isolation)",
  financial: "Financial Integrity (KPI Parity)",
  performance: "Performance Audit",
  architecture: "Architectural Boundaries",
};

export async function buildDashboardCertificationReport(): Promise<DashboardCertificationReport> {
  const { result, checks } = await buildDashboardCertificationResult();

  return {
    result,
    checks,
    remainingRisks: deriveRemainingRisks(result, checks),
    requiredManualChecks: REQUIRED_MANUAL_CHECKS,
    generatedAt: new Date().toISOString(),
  };
}

function deriveRemainingRisks(
  result: DashboardCertificationResult,
  checks: DashboardCertificationCheckResult[],
): string[] {
  const risks = [...REMAINING_RISKS];

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

  if (result.performanceAudit.liveDatabase && !result.performanceAudit.allWithinTarget) {
    risks.unshift(
      `Performance: slowest role ${result.performanceAudit.slowestRole} at ${result.performanceAudit.slowestDurationMs}ms (target ${1000}ms).`,
    );
  }

  return risks;
}

export function formatDashboardSubsystemScoreLine(
  subsystem: DashboardCertificationSubsystem,
  status: DashboardCertificationStatus,
): string {
  const label = SUBSYSTEM_LABELS[subsystem];
  const flag = status.passed ? "PASS" : "REVIEW";
  return `${label}: ${status.score}/10 (${flag}) — ${status.passedChecks} passed, ${status.failedChecks} failed, ${status.warnings} warnings`;
}

export function formatDashboardCertificationSummaryLine(
  result: DashboardCertificationResult,
): string {
  const ready = result.productionReady ? "YES" : "NO";
  const phase09b = result.phase09bApproved ? "APPROVED" : "BLOCKED";
  return `Dashboard Certification ${result.certificationVersion}: ${result.overallScore}/10 — Production Ready: ${ready} — PHASE_09B: ${phase09b} (${result.passedChecks} passed, ${result.failedChecks} failed, ${result.warningCount} warnings)`;
}

export function buildDashboardCertificationExecutiveSummary(
  report: DashboardCertificationReport,
): string[] {
  const lines: string[] = [
    "═".repeat(72),
    "NAZMA ERP — ENTERPRISE DASHBOARD CERTIFICATION (PHASE_09A.5)",
    "═".repeat(72),
    formatDashboardCertificationSummaryLine(report.result),
    "",
    "Subsystem Scores",
    "─".repeat(40),
    `Security:      ${report.result.securityScore}/10`,
    `Financial:     ${report.result.financialScore}/10`,
    `Performance:   ${report.result.performanceScore}/10`,
    `Architecture:  ${report.result.architectureScore}/10`,
    "",
  ];

  for (const subsystem of Object.keys(
    report.result.subsystems,
  ) as DashboardCertificationSubsystem[]) {
    lines.push(
      formatDashboardSubsystemScoreLine(subsystem, report.result.subsystems[subsystem]),
    );
  }

  if (report.result.performanceAudit.measurements.length > 0) {
    lines.push("", "Performance Audit", "─".repeat(40));
    for (const measurement of report.result.performanceAudit.measurements) {
      lines.push(
        `  ${measurement.role}: ${measurement.durationMs}ms, ${measurement.payloadBytes} bytes ${measurement.withinTarget ? "✓" : "⚠"}`,
      );
    }
    lines.push(
      `  Slowest: ${report.result.performanceAudit.slowestRole} (${report.result.performanceAudit.slowestDurationMs}ms)`,
    );
    lines.push(
      `  Query surface: ${report.result.performanceAudit.estimatedQuerySurface} Prisma call sites`,
    );
  }

  lines.push("", "Findings", "─".repeat(40));
  if (report.result.findings.length === 0) {
    lines.push("  None — all critical checks passed.");
  } else {
    for (const finding of report.result.findings) {
      lines.push(`  • ${finding}`);
    }
  }

  lines.push("", "PHASE_09B Recommendation", "─".repeat(40));
  lines.push(
    report.result.phase09bApproved
      ? "  ✓ APPROVE PHASE_09B (Dashboard BI & Charts)"
      : "  ✗ BLOCK PHASE_09B until critical findings resolved",
  );

  lines.push("═".repeat(72));
  return lines;
}
