import type {
  CertificationCheckResult,
  CertificationStatus,
  CertificationSubsystem,
  FinancialCertificationReport,
  FinancialCertificationResult,
} from "./financial-certification-types";
import { buildFinancialCertificationResult } from "./financial-certification-service";

/**
 * Human-readable Financial Certification Report — PHASE_07F.
 *
 * Presentation only — aggregates check outcomes into an executive summary.
 *
 * @see ADR-037
 */

const REMAINING_RISKS = [
  "No invoice void / credit note workflow (F1 — KNOWN_RISKS.md).",
  "Collection concurrency integration tests not yet mirroring invoice suite (C1).",
  "Pre-existing integration tests use registration-time skipIf and may never execute (T3 / TECH_DEBT C8).",
  "No DB-level ledger immutability policy — application guard only (TECH_DEBT C6).",
  "Full GL / Chart of Accounts not architected — AR subledger only (A2).",
  "Statement Excel / email export and due reports not yet built (PHASE_08).",
  "Cron wiring and integrity notifications not yet configured.",
];

const REQUIRED_MANUAL_CHECKS = [
  "Run `npx vitest run` with DATABASE_URL against Docker PostgreSQL before production cutover.",
  "Execute live opening balance concurrency tests (`opening-balance-concurrency.integration.test.ts`).",
  "Verify browser print output for Dealer Statement on Chrome and Edge.",
  "Rotate seed credentials documented in NEXT_ACTION.md before production deploy.",
  "Run `prisma migrate deploy` in deployment pipeline to prevent enum drift (D2).",
  "Review `/ledger/integrity` console after first production data load.",
  "Confirm all dealers have Opening Balance initialized or replay completed before go-live.",
];

const SUBSYSTEM_LABELS: Record<CertificationSubsystem, string> = {
  ledger: "Ledger Foundation (PHASE_07A)",
  posting: "Posting Engine (PHASE_07B)",
  openingBalance: "Opening Balance (PHASE_07C)",
  statement: "Statement Engine + Documents (PHASE_07D)",
  replay: "Historical Replay (PHASE_07E2)",
  reconciliation: "Reconciliation Engine (PHASE_07E3)",
  integrityMonitor: "Integrity Monitor + Console (PHASE_07E4/E5)",
  audit: "Audit Traceability",
};

/** Build the full certification report. */
export async function buildFinancialCertificationReport(): Promise<FinancialCertificationReport> {
  const { result, checks, performance } = await buildFinancialCertificationResult();

  return {
    result,
    checks,
    performance,
    remainingRisks: deriveRemainingRisks(result, checks),
    requiredManualChecks: REQUIRED_MANUAL_CHECKS,
    generatedAt: new Date().toISOString(),
  };
}

function deriveRemainingRisks(
  result: FinancialCertificationResult,
  checks: CertificationCheckResult[],
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

  return [...new Set(risks)];
}

export function formatCertificationSummaryLine(
  result: FinancialCertificationResult,
): string {
  return [
    `Score: ${result.overallScore}/10`,
    `Passed: ${result.passedChecks}`,
    `Failed: ${result.failedChecks}`,
    `Warnings: ${result.warnings}`,
    `Production Ready: ${result.productionReady ? "YES" : "NO"}`,
  ].join(" | ");
}

export function formatSubsystemScoreLine(
  subsystem: CertificationSubsystem,
  status: CertificationStatus,
): string {
  return `${SUBSYSTEM_LABELS[subsystem]}: ${status.score}/10 (${status.passedChecks} pass, ${status.failedChecks} fail, ${status.warnings} warn)`;
}

export function buildCertificationExecutiveSummary(
  report: FinancialCertificationReport,
): string[] {
  const lines = [
    `Enterprise Financial System Certification v${report.result.certificationVersion}`,
    formatCertificationSummaryLine(report.result),
    "",
    "Subsystem Scores:",
  ];

  for (const [subsystem, status] of Object.entries(report.result.subsystems) as Array<
    [CertificationSubsystem, CertificationStatus]
  >) {
    lines.push(`  - ${formatSubsystemScoreLine(subsystem, status)}`);
  }

  if (report.performance) {
    lines.push(
      "",
      "Performance (measure only):",
      `  - Dealers: ${report.performance.dealerCount}`,
      `  - Ledger rows: ${report.performance.ledgerRowCount}`,
      `  - Reconciliation: ${report.performance.reconciliationDurationMs}ms`,
      `  - Statement sample: ${report.performance.statementSampleDurationMs ?? "n/a"}ms`,
    );
  }

  lines.push("", `Failed checks: ${report.result.failedChecks}`);
  lines.push(`Warnings: ${report.result.warnings}`);
  lines.push(`Production ready: ${report.result.productionReady ? "YES" : "NO"}`);

  return lines;
}

export { SUBSYSTEM_LABELS, REQUIRED_MANUAL_CHECKS, REMAINING_RISKS };
