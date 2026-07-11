import type {
  AgingBalanceReconciliation,
  TerritoryCertificationCheckResult,
  TerritoryCertificationReport,
  TerritoryCertificationResult,
  TerritoryCertificationStatus,
  TerritoryCertificationSubsystem,
} from "./territory-certification-types";
import { buildTerritoryCertificationResult } from "./territory-certification-service";

/**
 * Human-readable Territory & Due Certification Report — PHASE_08E.
 *
 * @see ADR-041
 */

const REMAINING_RISKS = [
  "Invoice aging total may differ from Dealer.currentBalance when opening balances or unallocated collections exist — by design (ADR-040).",
  "Dealer.lastInvoiceDate not auto-updated on every invoice issue — recency field may be stale.",
  "DueReport Prisma snapshot table unused — live query only (scheduled snapshots deferred).",
  "No invoice void / credit note workflow — billing corrections require manual workarounds (F1).",
];

const REQUIRED_MANUAL_CHECKS = [
  "Verify SR user cannot access dealers outside assigned territories via browser.",
  "Verify Manager user sees only assigned territory dealers in /dealers and /reports/due.",
  "Execute dealer territory transfer and confirm ownership timeline at /dealers/[dealerCode]/ownership.",
  "Confirm old invoices remain unchanged after dealer transfer.",
  "Run `npx vitest run` with DATABASE_URL for full integration coverage.",
  "Review /reports/due aging summary against sample dealer statements.",
];

const SUBSYSTEM_LABELS: Record<TerritoryCertificationSubsystem, string> = {
  territorySecurity: "Territory Security (PHASE_08B)",
  ownershipIntegrity: "Ownership Integrity (PHASE_08C)",
  dueAccuracy: "Due Report Accuracy (PHASE_08D)",
  financialBoundary: "Financial Boundary Isolation",
};

export async function buildTerritoryCertificationReport(): Promise<TerritoryCertificationReport> {
  const { result, checks, agingReconciliations } =
    await buildTerritoryCertificationResult();

  return {
    result,
    checks,
    agingReconciliations,
    remainingRisks: deriveRemainingRisks(result, checks),
    requiredManualChecks: REQUIRED_MANUAL_CHECKS,
    generatedAt: new Date().toISOString(),
  };
}

function deriveRemainingRisks(
  result: TerritoryCertificationResult,
  checks: TerritoryCertificationCheckResult[],
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

  return risks;
}

export function formatSubsystemScoreLine(
  subsystem: TerritoryCertificationSubsystem,
  status: TerritoryCertificationStatus,
): string {
  const label = SUBSYSTEM_LABELS[subsystem];
  const flag = status.passed ? "PASS" : "REVIEW";
  return `${label}: ${status.score}/10 (${flag}) — ${status.passedChecks} passed, ${status.failedChecks} failed, ${status.warnings} warnings`;
}

export function formatCertificationSummaryLine(
  result: TerritoryCertificationResult,
): string {
  const ready = result.productionReady ? "YES" : "NO";
  return `Territory & Due Certification ${result.certificationVersion}: ${result.overallScore}/10 — Production Ready: ${ready} (${result.passedChecks} passed, ${result.failedChecks} failed, ${result.warnings} warnings)`;
}

export function formatAgingReconciliationLine(
  reconciliation: AgingBalanceReconciliation,
): string {
  const explained =
    reconciliation.explainedBy.length > 0
      ? reconciliation.explainedBy.join(", ")
      : "matched";
  return `${reconciliation.dealerCode}: balance=${reconciliation.dealerBalance}, aging=${reconciliation.totalInvoiceAging}, delta=${reconciliation.delta} (${explained})`;
}

export function buildCertificationExecutiveSummary(
  report: TerritoryCertificationReport,
): string[] {
  const lines: string[] = [
    "═".repeat(72),
    "NAZMA ERP — ENTERPRISE TERRITORY & DUE CERTIFICATION",
    "═".repeat(72),
    formatCertificationSummaryLine(report.result),
    "",
    "Subsystem Scores",
    "─".repeat(40),
  ];

  for (const subsystem of Object.keys(
    report.result.subsystems,
  ) as TerritoryCertificationSubsystem[]) {
    lines.push(
      formatSubsystemScoreLine(subsystem, report.result.subsystems[subsystem]),
    );
  }

  lines.push("", "Aging vs Balance Reconciliation (Rule 7)", "─".repeat(40));
  for (const reconciliation of report.agingReconciliations) {
    lines.push(formatAgingReconciliationLine(reconciliation));
  }

  lines.push("", "Check Results", "─".repeat(40));
  for (const check of report.checks) {
    const status = !check.passed ? "FAIL" : check.warning ? "WARN" : "PASS";
    lines.push(`[${status}] ${check.id}: ${check.message}`);
  }

  if (report.remainingRisks.length > 0) {
    lines.push("", "Remaining Risks", "─".repeat(40));
    for (const risk of report.remainingRisks) {
      lines.push(`• ${risk}`);
    }
  }

  lines.push("", `Generated: ${report.generatedAt}`);
  lines.push("═".repeat(72));

  return lines;
}
