import { describe, expect, it } from "vitest";

import {
  runProductSalesCertificationChecks,
  runTerritoryProductSalesCertification,
} from "@/lib/certification/product-sales";

describe("PHASE_12B product sales certification", () => {
  it("passes RULE_PRODUCT_SALES_01–17 structural gates", () => {
    const checks = runProductSalesCertificationChecks();
    const failed = checks.filter((c) => !c.passed);
    expect(failed.map((c) => `${c.id}: ${c.message}`)).toEqual([]);
    expect(checks.some((c) => c.id === "RULE_PRODUCT_SALES_16" && c.passed)).toBe(
      true,
    );
    expect(checks.some((c) => c.id === "RULE_PRODUCT_SALES_17" && c.passed)).toBe(
      true,
    );
  });

  it("approves PHASE_12B when all rules pass", () => {
    const result = runTerritoryProductSalesCertification();
    expect(result.phase).toBe("PHASE_12B");
    expect(result.phase12bApproved).toBe(true);
    expect(result.approved).toBe(true);
    expect(result.scores.security).toBeGreaterThanOrEqual(9);
    expect(result.scores.dataAccuracy).toBeGreaterThanOrEqual(9);
    expect(result.scores.dashboardReadiness).toBeGreaterThanOrEqual(9);
  });
});
