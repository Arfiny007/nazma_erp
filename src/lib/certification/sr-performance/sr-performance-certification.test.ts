import { describe, expect, it } from "vitest";

import {
  runSrPerformanceCertification,
  runSrPerformanceCertificationChecks,
} from "./index";

describe("sr-performance certification", () => {
  it("passes all structural rules", () => {
    const checks = runSrPerformanceCertificationChecks();
    const failed = checks.filter((check) => !check.passed);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
  });

  it("approves PHASE_12A.1 when checks pass", () => {
    const result = runSrPerformanceCertification();
    expect(result.phase).toBe("PHASE_12A.1");
    expect(result.phase12a1Approved).toBe(true);
    expect(result.approved).toBe(true);
    expect(result.phase12aApproved).toBe(true);
    expect(result.scores.security).toBeGreaterThanOrEqual(9);
    expect(result.scores.financialAccuracy).toBeGreaterThanOrEqual(9);
  });

  it("includes repository-wide ESLint gate rule", () => {
    const checks = runSrPerformanceCertificationChecks();
    const eslintGate = checks.find((check) => check.id === "RULE_SR_REPORT_15");
    expect(eslintGate).toBeDefined();
    expect(eslintGate?.passed).toBe(true);
  });
});
