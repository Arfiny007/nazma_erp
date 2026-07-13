import type {
  AuthenticationCertificationCheckResult,
  AuthenticationCertificationReport,
  AuthenticationCertificationResult,
  AuthenticationCertificationStatus,
  AuthenticationCertificationSubsystem,
} from "./authentication-certification-types";
import { buildAuthenticationCertificationResult } from "./authentication-certification-service";

/**
 * Human-readable Authentication Certification Report — PHASE_10D.
 *
 * @see ADR-052
 */

const REMAINING_RISKS = [
  "Email/SMS delivery not implemented — activation and reset links distributed manually.",
  "Live performance audit requires DATABASE_URL and demo seed users.",
  "JWT mustChangePassword is set at login — session refresh relies on re-signIn after password change.",
  "MFA / OTP not implemented — out of scope for PHASE_10C/10D.",
];

const REQUIRED_MANUAL_CHECKS = [
  "Create PENDING_ACTIVATION user — verify activation URL and temporary password shown once.",
  "Complete activation via /auth/activate — confirm ACTIVE lifecycle and login without mustChangePassword.",
  "Activate user with temp password — login and confirm redirect to /auth/change-password.",
  "Attempt /dashboard while mustChangePassword=true — confirm middleware redirect.",
  "Request password reset — use dev link in development; complete /auth/reset-password.",
  "Verify audit console shows USER_ACTIVATION_* and USER_PASSWORD_* events.",
  "Run `npx vitest run src/lib/certification/auth` after auth layer changes.",
];

const SUBSYSTEM_LABELS: Record<AuthenticationCertificationSubsystem, string> = {
  security: "Security (Privilege Escalation & Activation)",
  passwordSecurity: "Password Security",
  tokenSecurity: "Token Security",
  sessionSecurity: "Session & Login Enforcement",
  auditCoverage: "Audit Trail Completeness",
  financialBoundary: "Financial Boundary",
  architecture: "Architectural Boundaries",
  performance: "Performance Audit",
};

export async function buildAuthenticationCertificationReport(): Promise<AuthenticationCertificationReport> {
  const { result, checks } = await buildAuthenticationCertificationResult();

  return {
    result,
    checks,
    remainingRisks: deriveRemainingRisks(result, checks),
    requiredManualChecks: REQUIRED_MANUAL_CHECKS,
    generatedAt: new Date().toISOString(),
  };
}

function deriveRemainingRisks(
  result: AuthenticationCertificationResult,
  checks: AuthenticationCertificationCheckResult[],
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

export function formatAuthSubsystemScoreLine(
  subsystem: AuthenticationCertificationSubsystem,
  status: AuthenticationCertificationStatus,
): string {
  const label = SUBSYSTEM_LABELS[subsystem];
  const flag = status.passed ? "PASS" : "REVIEW";
  return `${label}: ${status.score}/10 (${flag}) — ${status.passedChecks} passed, ${status.failedChecks} failed, ${status.warnings} warnings`;
}

export function formatAuthenticationCertificationSummaryLine(
  result: AuthenticationCertificationResult,
): string {
  const ready = result.productionReady ? "YES" : "NO";
  const phase10d = result.phase10dApproved ? "APPROVED" : "BLOCKED";
  return `Authentication Certification ${result.certificationVersion}: ${result.overallScore}/10 — Production Ready: ${ready} — PHASE_10D: ${phase10d} (${result.passedChecks} passed, ${result.failedChecks} failed, ${result.warningCount} warnings)`;
}

export function buildAuthenticationCertificationExecutiveSummary(
  report: AuthenticationCertificationReport,
): string[] {
  const lines: string[] = [
    "═".repeat(72),
    "NAZMA ERP — ENTERPRISE AUTHENTICATION CERTIFICATION (PHASE_10D)",
    "═".repeat(72),
    formatAuthenticationCertificationSummaryLine(report.result),
    "",
    "Subsystem Scores",
    "─".repeat(40),
    `Security:             ${report.result.securityScore}/10`,
    `Password Security:    ${report.result.passwordSecurityScore}/10`,
    `Token Security:       ${report.result.tokenSecurityScore}/10`,
    `Session Security:     ${report.result.sessionSecurityScore}/10`,
    `Audit Coverage:       ${report.result.auditCoverageScore}/10`,
    `Financial Boundary:   ${report.result.financialBoundaryScore}/10`,
    `Architecture:         ${report.result.architectureScore}/10`,
    `Performance:          ${report.result.performanceScore}/10`,
    "",
  ];

  for (const subsystem of Object.keys(
    report.result.subsystems,
  ) as AuthenticationCertificationSubsystem[]) {
    lines.push(
      formatAuthSubsystemScoreLine(subsystem, report.result.subsystems[subsystem]),
    );
  }

  lines.push("", "Authentication Audit Coverage", "─".repeat(40));
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
        `  ${measurement.operation}/${measurement.path}: ${measurement.durationMs}ms (~${measurement.queryCountEstimate} queries) ${measurement.withinTarget ? "✓" : "⚠"}`,
      );
    }
    lines.push(
      `  Slowest: ${report.result.performanceAudit.slowestOperation} (${report.result.performanceAudit.slowestDurationMs}ms)`,
    );
    lines.push(
      `  Query surface: ${report.result.performanceAudit.estimatedQuerySurface} Prisma call sites`,
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
