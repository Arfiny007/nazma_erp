import {
  PRODUCT_SALES_CERTIFICATION_VERSION,
  type ProductSalesCertificationResult,
  type ProductSalesCertificationScores,
} from "./product-sales-certification-types";
import { runProductSalesCertificationChecks } from "./product-sales-certification-validation";

function scoreFromChecks(
  checks: ReturnType<typeof runProductSalesCertificationChecks>,
  ids: string[],
): number {
  const selected = checks.filter((check) => ids.includes(check.id));
  if (selected.length === 0) return 0;
  const passed = selected.filter((check) => check.passed).length;
  return Number(((passed / selected.length) * 10).toFixed(1));
}

function buildScores(
  checks: ReturnType<typeof runProductSalesCertificationChecks>,
): ProductSalesCertificationScores {
  return {
    security: scoreFromChecks(checks, [
      "RULE_PRODUCT_SALES_01",
      "RULE_PRODUCT_SALES_06",
      "RULE_PRODUCT_SALES_07",
    ]),
    dataAccuracy: scoreFromChecks(checks, [
      "RULE_PRODUCT_SALES_02",
      "RULE_PRODUCT_SALES_03",
      "RULE_PRODUCT_SALES_04",
      "RULE_PRODUCT_SALES_05",
      "RULE_PRODUCT_SALES_08",
      "RULE_PRODUCT_SALES_12",
      "RULE_PRODUCT_SALES_16",
    ]),
    performance: scoreFromChecks(checks, [
      "RULE_PRODUCT_SALES_09",
      "RULE_PRODUCT_SALES_10",
    ]),
    architecture: scoreFromChecks(checks, [
      "RULE_PRODUCT_SALES_01",
      "RULE_PRODUCT_SALES_14",
      "RULE_PRODUCT_SALES_15",
      "RULE_PRODUCT_SALES_16",
    ]),
    dashboardReadiness: scoreFromChecks(checks, [
      "RULE_PRODUCT_SALES_11",
      "RULE_PRODUCT_SALES_12",
      "RULE_PRODUCT_SALES_13",
    ]),
  };
}

export function runTerritoryProductSalesCertification(): ProductSalesCertificationResult {
  const checks = runProductSalesCertificationChecks();
  const scores = buildScores(checks);
  const failed = checks.filter((check) => !check.passed);
  const warnings = checks
    .filter((check) => check.status === "warning")
    .map((check) => check.message);

  const phase12bApproved = failed.length === 0;
  const average =
    (scores.security +
      scores.dataAccuracy +
      scores.performance +
      scores.architecture +
      scores.dashboardReadiness) /
    5;

  return {
    phase: "PHASE_12B",
    version: PRODUCT_SALES_CERTIFICATION_VERSION,
    generatedAt: new Date().toISOString(),
    checks,
    scores,
    warnings,
    manualChecks: [
      "Confirm Super_Admin / Manager / SR browser smoke for report + dashboard chart",
      "Confirm Accounts cannot open /reports/product-sales-by-territory",
      "Confirm Manager foreign territoryId is rejected",
      "Confirm product/category/search filters load without SQL alias errors",
      "Confirm Docker image recreate parity after final build",
    ],
    phase12bApproved,
    approved: phase12bApproved,
    productionReady: phase12bApproved && average >= 9.5,
  };
}

export function runTerritoryProductSalesCertificationWithReport(): {
  result: ProductSalesCertificationResult;
  executiveSummary: string;
} {
  const result = runTerritoryProductSalesCertification();
  const executiveSummary = [
    `PHASE_12B Territory Product Sales Certification ${result.version}`,
    `Approved: ${result.phase12bApproved ? "YES" : "NO"}`,
    `Security ${result.scores.security}/10 · Data ${result.scores.dataAccuracy}/10 · Performance ${result.scores.performance}/10 · Architecture ${result.scores.architecture}/10 · Dashboard ${result.scores.dashboardReadiness}/10`,
    `Checks passed: ${result.checks.filter((c) => c.passed).length}/${result.checks.length}`,
  ].join("\n");

  return { result, executiveSummary };
}
