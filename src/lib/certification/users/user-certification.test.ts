import { describe, expect, it } from "vitest";

import {
  aggregateSubsystemStatuses,
  buildUserAuditCoverageReport,
  buildUserCertificationExecutiveSummary,
  buildUserCertificationResult,
  computeOverallScore,
  countUserQuerySurface,
  runAllUserCertificationChecks,
  runUserCertificationWithReport,
  scanUserArchitectureImports,
  scanUserFinancialBoundary,
  scanUserTerritoryLeakage,
  USER_CERTIFICATION_CHECK_CATALOG,
  verifyAccountsRestrictions,
  verifyLifecycleCorrectness,
  verifyManagerIsolation,
  verifyManagerTerritoryVisibilitySignals,
  verifyPrivilegeEscalationBlocked,
  verifySrIsolation,
  verifySuperAdminAuthority,
  verifyUserPasswordSecurity,
} from "@/lib/certification/users";
import { assertLifecycleTransition } from "@/lib/users/user-lifecycle";
import { RoleEscalationError } from "@/lib/users/user-errors";
import { assertAssignableRole } from "@/lib/users/user-validation";
import type { AuthUser } from "@/types/auth";

/**
 * Enterprise User Management Certification tests — PHASE_10B.
 */

describe("User Certification — catalog", () => {
  it("defines checks for all 12 certification rules", () => {
    const ruleNumbers = USER_CERTIFICATION_CHECK_CATALOG.filter(
      (check) => check.ruleNumber !== undefined,
    ).map((check) => check.ruleNumber);

    expect([...ruleNumbers].sort((a, b) => a! - b!)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });
});

describe("Rule 1 — Super Admin authority", () => {
  it("grants full user lifecycle permissions", () => {
    expect(verifySuperAdminAuthority()).toBe(true);
  });
});

describe("Rule 2 — Manager isolation", () => {
  it("blocks activate/disable and role escalation", () => {
    const result = verifyManagerIsolation();
    expect(result.ok).toBe(true);
  });
});

describe("Rule 3 — SR isolation", () => {
  it("denies user console access and foreign profiles", () => {
    const result = verifySrIsolation();
    expect(result.ok).toBe(true);
  });
});

describe("Rule 4 — Accounts restrictions", () => {
  it("allows view-only without mutation permissions", () => {
    const result = verifyAccountsRestrictions();
    expect(result.ok).toBe(true);
  });
});

describe("Rule 5 — Territory security", () => {
  it("requires territory scope signals in validation layer", () => {
    expect(verifyManagerTerritoryVisibilitySignals()).toBe(true);
  });

  it("finds no territory leakage in user service paths", () => {
    expect(scanUserTerritoryLeakage()).toEqual([]);
  });
});

describe("Rule 6 — Privilege escalation", () => {
  it("blocks SR → Manager, SR → Super_Admin, Manager → Super_Admin, Accounts → Manager", () => {
    const result = verifyPrivilegeEscalationBlocked();
    expect(result.ok).toBe(true);
  });

  it("throws RoleEscalationError for Manager creating Manager", () => {
    const manager: AuthUser = {
      id: "mgr",
      role: "Manager",
      email: "mgr@test",
      name: "Manager",
      isActive: true,
    };
    expect(() => assertAssignableRole(manager, "Manager")).toThrow(RoleEscalationError);
  });
});

describe("Rule 7 — Lifecycle correctness", () => {
  it("rejects ARCHIVED → ACTIVE direct reactivation", () => {
    expect(() => assertLifecycleTransition("ARCHIVED", "ACTIVE")).toThrow();
  });

  it("allows DISABLED → ACTIVE reactivation path", () => {
    expect(() => assertLifecycleTransition("DISABLED", "ACTIVE")).not.toThrow();
  });

  it("passes full lifecycle verification", () => {
    const result = verifyLifecycleCorrectness();
    expect(result.ok).toBe(true);
  });
});

describe("Rule 8 — Audit completeness", () => {
  it("measures user audit coverage with covered bucket", () => {
    const coverage = buildUserAuditCoverageReport();
    expect(coverage.covered.length).toBeGreaterThanOrEqual(5);
    expect(coverage.covered).toContain("User created");
    expect(coverage.covered).toContain("User activated");
    expect(coverage.covered).toContain("User deactivated");
    expect(coverage.covered).toContain("User role changed");
    expect(coverage.covered).toContain("User updated");
    expect(coverage.missing).toEqual([]);
  });
});

describe("Rule 9 — Financial boundary", () => {
  it("finds no forbidden financial writers in user module", () => {
    expect(scanUserFinancialBoundary()).toEqual([]);
  });
});

describe("Rule 10 — Architecture", () => {
  it("finds no forbidden imports in user module", () => {
    expect(scanUserArchitectureImports()).toEqual([]);
  });
});

describe("Rule 12 — Security", () => {
  it("verifies password hashing policies", () => {
    const result = verifyUserPasswordSecurity();
    expect(result.ok).toBe(true);
  });
});

describe("User Certification — integration", () => {
  it("runs all checks and achieves production readiness threshold", async () => {
    const { checks, auditCoverage } = await runAllUserCertificationChecks();
    const totals = computeOverallScore(checks);
    const subsystems = aggregateSubsystemStatuses(checks);

    expect(checks.length).toBeGreaterThanOrEqual(12);
    expect(totals.failedChecks).toBe(0);
    expect(totals.overallScore).toBeGreaterThanOrEqual(9);
    expect(totals.productionReady).toBe(true);
    expect(subsystems.security.passed).toBe(true);
    expect(subsystems.territoryIsolation.passed).toBe(true);
    expect(subsystems.lifecycle.passed).toBe(true);
    expect(subsystems.financialBoundary.passed).toBe(true);
    expect(auditCoverage.missing).toEqual([]);
  }, 30_000);

  it("builds certification result with phase10c approval", async () => {
    const { result } = await buildUserCertificationResult();
    expect(result.productionReady).toBe(true);
    expect(result.phase10cApproved).toBe(true);
    expect(result.securityScore).toBeGreaterThanOrEqual(8);
    expect(result.territoryIsolationScore).toBeGreaterThanOrEqual(8);
    expect(result.lifecycleScore).toBeGreaterThanOrEqual(8);
    expect(result.auditCoverageScore).toBeGreaterThanOrEqual(8);
    expect(result.financialBoundaryScore).toBeGreaterThanOrEqual(8);
    expect(result.architectureScore).toBeGreaterThanOrEqual(8);
  }, 30_000);

  it("generates executive summary", async () => {
    const report = await runUserCertificationWithReport();
    const summary = buildUserCertificationExecutiveSummary(report);
    expect(summary.some((line) => line.includes("PHASE_10B"))).toBe(true);
    expect(summary.some((line) => line.includes("Security:"))).toBe(true);
  }, 30_000);

  it("measures structural query surface", () => {
    expect(countUserQuerySurface()).toBeGreaterThan(0);
  });
});
