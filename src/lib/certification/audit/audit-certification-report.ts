import type {
  AuditCertificationCheckResult,
  AuditCertificationReport,
  AuditCertificationResult,
  AuditCertificationStatus,
  AuditCertificationSubsystem,
} from "./audit-certification-types";
import { buildAuditCertificationResult } from "./audit-certification-service";

/**
 * Human-readable Audit Certification Report — PHASE_09D.5.
 *
 * @see ADR-047
 */

const REMAINING_RISKS = [
  "Security and integrity workflows (login, user creation, territory assignment) do not yet write AuditLog rows — console cannot display events that were never persisted.",
  "Integrity monitor and reconciliation engines do not persist audit rows — reserved action constants only.",
  "Dealer create/update/transfer workflows lack dedicated audit writers — ownership history exists but is not mirrored in AuditLog.",
  "Live performance audit requires demo seed users and DATABASE_URL.",
  "Summary card counts sample up to 5000 recent rows — totals may diverge on very large histories.",
];

const REQUIRED_MANUAL_CHECKS = [
  "Log in as Super Admin and open /audit — confirm financial, operational, and dealer events visible.",
  "Log in as Accounts and confirm only financial/integrity categories appear.",
  "Log in as Manager (manager1@nazma.test) and confirm foreign territory events are absent.",
  "Log in as SR (sr1@nazma.test) and confirm only assigned-dealer events appear.",
  "Search by dealer code, invoice number, and collection number on /audit.",
  "Confirm audit console has no edit/replay/repair controls.",
  "Run `npx vitest run src/lib/certification/audit` after schema or RBAC changes.",
];

const SUBSYSTEM_LABELS: Record<AuditCertificationSubsystem, string> = {
  security: "Audit Security (Role Visibility)",
  financialIntegrity: "Financial Immutability",
  territoryIsolation: "Territory Isolation",
  auditCoverage: "Audit Trail Completeness",
  architecture: "Architectural Boundaries",
  performance: "Performance Audit",
};

export async function buildAuditCertificationReport(): Promise<AuditCertificationReport> {
  const { result, checks } = await buildAuditCertificationResult();

  return {
    result,
    checks,
    remainingRisks: deriveRemainingRisks(result, checks),
    requiredManualChecks: REQUIRED_MANUAL_CHECKS,
    generatedAt: new Date().toISOString(),
  };
}

function deriveRemainingRisks(
  result: AuditCertificationResult,
  checks: AuditCertificationCheckResult[],
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

export function formatAuditSubsystemScoreLine(
  subsystem: AuditCertificationSubsystem,
  status: AuditCertificationStatus,
): string {
  const label = SUBSYSTEM_LABELS[subsystem];
  const flag = status.passed ? "PASS" : "REVIEW";
  return `${label}: ${status.score}/10 (${flag}) — ${status.passedChecks} passed, ${status.failedChecks} failed, ${status.warnings} warnings`;
}

export function formatAuditCertificationSummaryLine(
  result: AuditCertificationResult,
): string {
  const ready = result.productionReady ? "YES" : "NO";
  const phase09e = result.phase09eApproved ? "APPROVED" : "BLOCKED";
  return `Audit Certification ${result.certificationVersion}: ${result.overallScore}/10 — Production Ready: ${ready} — PHASE_09E: ${phase09e} (${result.passedChecks} passed, ${result.failedChecks} failed, ${result.warningCount} warnings)`;
}

export function buildAuditCertificationExecutiveSummary(
  report: AuditCertificationReport,
): string[] {
  const lines: string[] = [
    "═".repeat(72),
    "NAZMA ERP — ENTERPRISE AUDIT & COMPLIANCE CERTIFICATION (PHASE_09D.5)",
    "═".repeat(72),
    formatAuditCertificationSummaryLine(report.result),
    "",
    "Subsystem Scores",
    "─".repeat(40),
    `Security:             ${report.result.securityScore}/10`,
    `Financial Integrity:  ${report.result.financialIntegrityScore}/10`,
    `Territory Isolation:  ${report.result.territoryIsolationScore}/10`,
    `Audit Coverage:       ${report.result.auditCoverageScore}/10`,
    `Architecture:         ${report.result.architectureScore}/10`,
    `Performance:          ${report.result.performanceScore}/10`,
    "",
  ];

  for (const subsystem of Object.keys(
    report.result.subsystems,
  ) as AuditCertificationSubsystem[]) {
    lines.push(
      formatAuditSubsystemScoreLine(subsystem, report.result.subsystems[subsystem]),
    );
  }

  lines.push("", "Audit Coverage", "─".repeat(40));
  lines.push(`  Covered (${report.result.coverage.covered.length}): ${report.result.coverage.covered.join(", ") || "none"}`);
  lines.push(`  Partial (${report.result.coverage.partial.length}): ${report.result.coverage.partial.join(", ") || "none"}`);
  lines.push(`  Missing (${report.result.coverage.missing.length}): ${report.result.coverage.missing.join(", ") || "none"}`);

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

  lines.push("", "PHASE_09E Recommendation", "─".repeat(40));
  lines.push(
    report.result.phase09eApproved
      ? "  ✓ APPROVE PHASE_09E (Audit Export & Compliance Archive)"
      : "  ✗ BLOCK PHASE_09E until critical findings resolved",
  );

  lines.push("═".repeat(72));
  return lines;
}
