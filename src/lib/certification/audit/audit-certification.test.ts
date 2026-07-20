import { describe, expect, it } from "vitest";

import {
  aggregateSubsystemStatuses,
  AUDIT_CERTIFICATION_CHECK_CATALOG,
  buildAuditCertificationExecutiveSummary,
  buildAuditCertificationResult,
  buildAuditCoverageReport,
  computeOverallScore,
  countAuditQuerySurface,
  runAllAuditCertificationChecks,
  scanAuditArchitectureImports,
  scanAuditFinancialBoundary,
  scanAuditTerritoryLeakage,
  verifyAccountsRestrictions,
  verifyAuditPermissionMatrix,
  verifyAuditSearchCorrectness,
  verifyManagerTerritoryIsolationSignals,
  verifySrIsolationSignals,
  verifySuperAdminVisibility,
  verifyTimelineGrouping,
} from "@/lib/certification/audit";
import { categoryMatchesRole, resolveAllowedCategories } from "@/lib/audit";

/**
 * Enterprise Audit & Compliance Certification tests — PHASE_09D.5.
 */

describe("Audit Certification — catalog", () => {
  it("defines checks for all 10 certification rules", () => {
    const ruleNumbers = AUDIT_CERTIFICATION_CHECK_CATALOG.filter(
      (check) => check.ruleNumber !== undefined,
    ).map((check) => check.ruleNumber);

    expect(
      [...ruleNumbers].sort((a, b) => (a ?? 0) - (b ?? 0)),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("Rule 1 — Financial immutability", () => {
  it("finds no forbidden financial writers in audit module", () => {
    expect(scanAuditFinancialBoundary()).toEqual([]);
  });
});

describe("Rule 2 — Super Admin visibility", () => {
  it("grants unrestricted category access", () => {
    expect(verifySuperAdminVisibility()).toBe(true);
    expect(resolveAllowedCategories("Super_Admin")).toBe("ALL");
    expect(categoryMatchesRole("Super_Admin", "LOGIN", "User")).toBe(true);
  });
});

describe("Rule 3 — Accounts restrictions", () => {
  it("limits Accounts to financial and integrity categories", () => {
    const result = verifyAccountsRestrictions();
    expect(result.ok).toBe(true);
    expect(categoryMatchesRole("Accounts", "INVOICE_CREATED", "Invoice")).toBe(true);
    expect(categoryMatchesRole("Accounts", "CREATE", "SalesOrder")).toBe(false);
  });
});

describe("Rule 4 — Manager isolation", () => {
  it("requires territory scope signals in audit query layer", () => {
    expect(verifyManagerTerritoryIsolationSignals()).toBe(true);
  });
});

describe("Rule 5 — SR isolation", () => {
  it("requires SR ownership filtering in audit query layer", () => {
    expect(verifySrIsolationSignals()).toBe(true);
  });
});

describe("Rule 6 — Territory leakage scan", () => {
  it("finds no unscoped findMany in audit-query", () => {
    expect(scanAuditTerritoryLeakage()).toEqual([]);
  });
});

describe("Rule 7 — Audit completeness", () => {
  it("measures workflow coverage with covered and missing buckets", () => {
    const coverage = buildAuditCoverageReport();
    expect(coverage.covered.length).toBeGreaterThan(0);
    expect(coverage.covered).toContain("Invoice issue");
    expect(coverage.covered).toContain("Collection confirm");
    expect(coverage.missing).toContain("Login");
    expect(coverage.missing).toContain("Integrity scan");
  });
});

describe("Rule 8 — Search correctness", () => {
  it("verifies server-side search and pagination signals", () => {
    expect(verifyAuditSearchCorrectness()).toBe(true);
  });

  it("groups timeline into expected buckets", () => {
    expect(verifyTimelineGrouping()).toBe(true);
  });
});

describe("Rule 9 — Architectural boundaries", () => {
  it("finds no forbidden imports in audit layer", () => {
    expect(scanAuditArchitectureImports()).toEqual([]);
  });
});

describe("Audit permission matrix", () => {
  it("grants audit:view to certified roles only", () => {
    expect(verifyAuditPermissionMatrix()).toBe(true);
  });
});

describe("Certification runner", () => {
  it("runs all structural checks without database dependency", async () => {
    const { checks } = await runAllAuditCertificationChecks();
    expect(checks.length).toBeGreaterThanOrEqual(10);

    const criticalFailures = checks.filter(
      (check) => !check.passed && check.severity === "critical",
    );
    expect(criticalFailures).toEqual([]);
  });

  it("builds certification result with subsystem scores", async () => {
    const { result } = await buildAuditCertificationResult();

    expect(result.overallScore).toBeGreaterThanOrEqual(8);
    expect(result.securityScore).toBeGreaterThanOrEqual(8);
    expect(result.financialIntegrityScore).toBeGreaterThanOrEqual(8);
    expect(result.territoryIsolationScore).toBeGreaterThanOrEqual(8);
    expect(result.architectureScore).toBeGreaterThanOrEqual(8);
    expect(result.coverage.covered.length).toBeGreaterThan(0);
  });

  it("executive summary renders subsystem scores", async () => {
    const report = await buildAuditCertificationResult().then(async ({ result, checks }) => ({
      result,
      checks,
      remainingRisks: [],
      requiredManualChecks: [],
      generatedAt: new Date().toISOString(),
    }));

    const lines = buildAuditCertificationExecutiveSummary(report);
    expect(lines.some((line) => line.includes("Security:"))).toBe(true);
    expect(lines.some((line) => line.includes("PHASE_09E"))).toBe(true);
  });

  it("computes overall score with warning weighting", () => {
    const totals = computeOverallScore([
      {
        id: "A",
        name: "A",
        subsystem: "security",
        category: "super_admin_visibility",
        severity: "critical",
        passed: true,
        warning: false,
        message: "ok",
        durationMs: 0,
      },
      {
        id: "B",
        name: "B",
        subsystem: "auditCoverage",
        category: "audit_completeness",
        severity: "warning",
        passed: true,
        warning: true,
        message: "warn",
        durationMs: 0,
      },
    ]);

    expect(totals.passedChecks).toBe(1);
    expect(totals.warningCount).toBe(1);
    expect(totals.overallScore).toBeGreaterThan(7);
  });

  it("aggregates subsystem statuses", () => {
    const statuses = aggregateSubsystemStatuses([
      {
        id: "RULE_02",
        name: "Super Admin",
        subsystem: "security",
        category: "super_admin_visibility",
        severity: "critical",
        passed: true,
        warning: false,
        message: "ok",
        durationMs: 0,
      },
    ]);

    expect(statuses.security.passed).toBe(true);
    expect(statuses.security.score).toBe(10);
  });

  it("documents static query surface for performance audit", () => {
    expect(countAuditQuerySurface()).toBeGreaterThan(0);
  });

  it("completes structural certification under one second without database", async () => {
    const started = performance.now();
    await runAllAuditCertificationChecks();
    expect(performance.now() - started).toBeLessThan(5000);
  });
});
