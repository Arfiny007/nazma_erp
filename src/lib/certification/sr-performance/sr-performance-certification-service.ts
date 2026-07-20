import {
  SR_PERFORMANCE_CERTIFICATION_VERSION,
  type SrPerformanceCertificationResult,
  type SrPerformanceCertificationScores,
} from "./sr-performance-certification-types";
import { runSrPerformanceCertificationChecks } from "./sr-performance-certification-validation";

function scoreFromChecks(
  checks: ReturnType<typeof runSrPerformanceCertificationChecks>,
  ids: string[],
): number {
  const selected = checks.filter((check) => ids.includes(check.id));
  if (selected.length === 0) return 0;
  const passed = selected.filter((check) => check.passed).length;
  return Number(((passed / selected.length) * 10).toFixed(1));
}

function buildScores(
  checks: ReturnType<typeof runSrPerformanceCertificationChecks>,
): SrPerformanceCertificationScores {
  return {
    security: scoreFromChecks(checks, [
      "RULE_SR_REPORT_01",
      "RULE_SR_REPORT_03",
      "RULE_SR_REPORT_05",
    ]),
    financialAccuracy: scoreFromChecks(checks, [
      "RULE_SR_REPORT_02",
      "RULE_SR_REPORT_04",
      "RULE_SR_REPORT_06",
      "RULE_SR_REPORT_07",
      "RULE_SR_REPORT_08",
      "RULE_SR_REPORT_09",
    ]),
    performance: scoreFromChecks(checks, ["RULE_SR_REPORT_12"]),
    architecture: scoreFromChecks(checks, [
      "RULE_SR_REPORT_01",
      "RULE_SR_REPORT_13",
      "RULE_SR_REPORT_14",
      "RULE_SR_REPORT_15",
    ]),
    printReadiness: scoreFromChecks(checks, [
      "RULE_SR_REPORT_10",
      "RULE_SR_REPORT_11",
    ]),
  };
}

export function runSrPerformanceCertification(): SrPerformanceCertificationResult {
  const checks = runSrPerformanceCertificationChecks();
  const scores = buildScores(checks);
  const failed = checks.filter((check) => !check.passed);
  const warnings = checks
    .filter((check) => check.status === "warning")
    .map((check) => check.message);

  const phase12a1Approved = failed.length === 0;
  /** Legacy alias — PHASE_12A.1 approval is authoritative. */
  const phase12aApproved = phase12a1Approved;
  const average =
    (scores.security +
      scores.financialAccuracy +
      scores.performance +
      scores.architecture +
      scores.printReadiness) /
    5;

  return {
    phase: "PHASE_12A.1",
    version: SR_PERFORMANCE_CERTIFICATION_VERSION,
    generatedAt: new Date().toISOString(),
    checks,
    scores,
    warnings,
    manualChecks: [
      "Confirm Manager cannot open /reports/sr-performance for foreign territories in a live session",
      "Confirm browser print/PDF remains vector A4 for a multi-page statement",
      "Confirm mandatory external gate `npx eslint .` remains green after any UI state change",
    ],
    phase12aApproved,
    phase12a1Approved,
    approved: phase12a1Approved,
    productionReady: phase12a1Approved && average >= 9.5,
  };
}

export function runSrPerformanceCertificationWithReport(): {
  result: SrPerformanceCertificationResult;
  executiveSummary: string;
} {
  const result = runSrPerformanceCertification();
  const executiveSummary = [
    `PHASE_12A.1 SR Performance Stabilization Certification ${result.version}`,
    `Approved: ${result.phase12a1Approved ? "YES" : "NO"}`,
    `Security ${result.scores.security}/10 · Financial ${result.scores.financialAccuracy}/10 · Performance ${result.scores.performance}/10 · Architecture ${result.scores.architecture}/10 · Print ${result.scores.printReadiness}/10`,
    `Checks passed: ${result.checks.filter((c) => c.passed).length}/${result.checks.length}`,
  ].join("\n");

  return { result, executiveSummary };
}
