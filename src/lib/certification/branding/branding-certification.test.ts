import { describe, expect, it } from "vitest";

import { runBrandingCertification } from "./branding-certification-service";
import { runBrandingCertificationChecks } from "./branding-certification-validation";

describe("branding certification", () => {
  it("passes all branding certification rules", () => {
    const result = runBrandingCertification();

    expect(result.passed).toBe(true);
    expect(result.findings).toEqual([]);

    for (const check of result.checks) {
      expect(check.passed, `${check.id}: ${check.message}`).toBe(true);
    }
  });

  it("requires middleware to expose branding assets without auth", () => {
    const middlewareRule = runBrandingCertificationChecks().find(
      (check) => check.id === "RULE_BRANDING_09_MIDDLEWARE_PUBLIC_ASSETS",
    );

    expect(middlewareRule?.passed).toBe(true);
  });
});
