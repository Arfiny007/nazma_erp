import type {
  UserCertificationCheckResult,
  UserCertificationReport,
  UserCertificationResult,
  UserCertificationStatus,
  UserCertificationSubsystem,
} from "./user-certification-types";
import { buildUserCertificationResult } from "./user-certification-service";

/**
 * Human-readable User Management Certification Report — PHASE_10B.
 *
 * @see ADR-050
 */

const REMAINING_RISKS = [
  "mustChangePassword is set on provisioning but not yet enforced at login — PHASE_10C scope.",
  "UserActivationToken model exists but token issuance flow is reserved for PHASE_10C.",
  "Email invitation dispatch is not implemented — Super Admin receives temporary password in UI only.",
  "Live performance audit requires demo seed users and DATABASE_URL.",
  "Territory-only updates share USER_UPDATED audit action without dedicated TERRITORY_ASSIGNED event.",
];

const REQUIRED_MANUAL_CHECKS = [
  "Log in as Super Admin and open /settings/users — create SR, assign territory, activate, disable.",
  "Log in as Manager (manager1@nazma.test) — confirm only SR users in assigned territories visible.",
  "Confirm Manager cannot activate/disable users or create Manager/Super_Admin roles.",
  "Log in as Accounts — confirm read-only user list without mutation controls.",
  "Log in as SR (sr1@nazma.test) — confirm /settings/users is blocked; self profile accessible via getUser.",
  "Verify audit console shows USER_CREATED / USER_ACTIVATED / USER_DEACTIVATED / USER_ROLE_CHANGED events.",
  "Run `npx vitest run src/lib/certification/users` after RBAC or lifecycle changes.",
];

const SUBSYSTEM_LABELS: Record<UserCertificationSubsystem, string> = {
  security: "Security (RBAC & Privilege Escalation)",
  territoryIsolation: "Territory Isolation",
  lifecycle: "Lifecycle State Machine",
  auditCoverage: "Audit Trail Completeness",
  financialBoundary: "Financial Boundary",
  architecture: "Architectural Boundaries",
  performance: "Performance Audit",
};

export async function buildUserCertificationReport(): Promise<UserCertificationReport> {
  const { result, checks } = await buildUserCertificationResult();

  return {
    result,
    checks,
    remainingRisks: deriveRemainingRisks(result, checks),
    requiredManualChecks: REQUIRED_MANUAL_CHECKS,
    generatedAt: new Date().toISOString(),
  };
}

function deriveRemainingRisks(
  result: UserCertificationResult,
  checks: UserCertificationCheckResult[],
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

export function formatUserSubsystemScoreLine(
  subsystem: UserCertificationSubsystem,
  status: UserCertificationStatus,
): string {
  const label = SUBSYSTEM_LABELS[subsystem];
  const flag = status.passed ? "PASS" : "REVIEW";
  return `${label}: ${status.score}/10 (${flag}) — ${status.passedChecks} passed, ${status.failedChecks} failed, ${status.warnings} warnings`;
}

export function formatUserCertificationSummaryLine(
  result: UserCertificationResult,
): string {
  const ready = result.productionReady ? "YES" : "NO";
  const phase10c = result.phase10cApproved ? "APPROVED" : "BLOCKED";
  return `User Certification ${result.certificationVersion}: ${result.overallScore}/10 — Production Ready: ${ready} — PHASE_10C: ${phase10c} (${result.passedChecks} passed, ${result.failedChecks} failed, ${result.warningCount} warnings)`;
}

export function buildUserCertificationExecutiveSummary(
  report: UserCertificationReport,
): string[] {
  const lines: string[] = [
    "═".repeat(72),
    "NAZMA ERP — ENTERPRISE USER MANAGEMENT CERTIFICATION (PHASE_10B)",
    "═".repeat(72),
    formatUserCertificationSummaryLine(report.result),
    "",
    "Subsystem Scores",
    "─".repeat(40),
    `Security:             ${report.result.securityScore}/10`,
    `Territory Isolation:  ${report.result.territoryIsolationScore}/10`,
    `Lifecycle:            ${report.result.lifecycleScore}/10`,
    `Audit Coverage:       ${report.result.auditCoverageScore}/10`,
    `Financial Boundary:   ${report.result.financialBoundaryScore}/10`,
    `Architecture:         ${report.result.architectureScore}/10`,
    `Performance:          ${report.result.performanceScore}/10`,
    "",
  ];

  for (const subsystem of Object.keys(
    report.result.subsystems,
  ) as UserCertificationSubsystem[]) {
    lines.push(
      formatUserSubsystemScoreLine(subsystem, report.result.subsystems[subsystem]),
    );
  }

  lines.push("", "User Audit Coverage", "─".repeat(40));
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
        `  ${measurement.role}/${measurement.operation}: ${measurement.durationMs}ms (~${measurement.queryCountEstimate} queries) ${measurement.withinTarget ? "✓" : "⚠"}`,
      );
    }
    lines.push(
      `  Slowest: ${report.result.performanceAudit.slowestOperation} (${report.result.performanceAudit.slowestDurationMs}ms)`,
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

  lines.push("", "PHASE_10C Recommendation", "─".repeat(40));
  lines.push(
    report.result.phase10cApproved
      ? "  ✓ APPROVE PHASE_10C (User Activation UX — login enforcement, optional email/OTP)"
      : "  ✗ BLOCK PHASE_10C until critical findings resolved",
  );

  lines.push("═".repeat(72));
  return lines;
}
