import { describe, expect, it } from "vitest";

import {
  isMustChangePasswordAllowedPath,
  resolvePostLoginRedirect,
} from "@/lib/auth/auth-routing";
import {
  aggregateSubsystemStatuses,
  AUTHENTICATION_CERTIFICATION_CHECK_CATALOG,
  buildAuthenticationAuditCoverageReport,
  buildAuthenticationCertificationExecutiveSummary,
  buildAuthenticationCertificationResult,
  computeOverallScore,
  countAuthQuerySurface,
  runAllAuthenticationCertificationChecks,
  runAuthenticationCertificationWithReport,
  scanAuthArchitectureImports,
  scanAuthFinancialBoundary,
  verifyActivationFlow,
  verifyExpiryRejectionSignals,
  verifyInvalidTokenRejection,
  verifyMustChangePasswordEnforcement,
  verifyPasswordResetFlow,
  verifyPasswordSecurity,
  verifyPrivilegeEscalationBlocked,
  verifyPublicAuthRouteIsolation,
  verifyReplayProtectionSignals,
  verifyRoleLoginMatrix,
  verifySessionSecurity,
  verifyTokenExpiryConstants,
  verifyTokenSecurity,
} from "@/lib/certification/auth";
import { hashToken } from "@/lib/users/user-tokens";

/**
 * Enterprise Authentication Certification tests — PHASE_10D.
 */

describe("Authentication Certification — catalog", () => {
  it("defines checks for all 12 certification rules", () => {
    const ruleNumbers = AUTHENTICATION_CERTIFICATION_CHECK_CATALOG.filter(
      (check) => check.ruleNumber !== undefined,
    ).map((check) => check.ruleNumber);

    expect([...ruleNumbers].sort((a, b) => a! - b!)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });
});

describe("Rule 1 — Password security", () => {
  it("verifies bcrypt hashing and no plaintext persist", () => {
    const result = verifyPasswordSecurity();
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
  });
});

describe("Rule 2 — Token security", () => {
  it("verifies hashed expiring one-time tokens", () => {
    const result = verifyTokenSecurity();
    expect(result.ok).toBe(true);
  });

  it("hashes tokens with SHA-256", () => {
    const plain = "sample-activation-token";
    const hashed = hashToken(plain);
    expect(hashed).not.toBe(plain);
    expect(hashed).toHaveLength(64);
  });

  it("defines activation and reset TTL constants", () => {
    const result = verifyTokenExpiryConstants();
    expect(result.ok).toBe(true);
  });
});

describe("Rule 3 — mustChangePassword enforcement", () => {
  it("blocks dashboard, settings, and reports", () => {
    const result = verifyMustChangePasswordEnforcement();
    expect(result.ok).toBe(true);
    expect(isMustChangePasswordAllowedPath("/dashboard")).toBe(false);
    expect(isMustChangePasswordAllowedPath("/settings")).toBe(false);
    expect(isMustChangePasswordAllowedPath("/reports")).toBe(false);
    expect(isMustChangePasswordAllowedPath("/auth/change-password")).toBe(true);
    expect(isMustChangePasswordAllowedPath("/api/auth/signout")).toBe(true);
  });
});

describe("Rule 4 — Activation flow", () => {
  it("verifies lifecycle transition and audit writers", () => {
    const result = verifyActivationFlow();
    expect(result.ok).toBe(true);
  });
});

describe("Rule 5 — Password reset flow", () => {
  it("verifies request, validate, and complete reset infrastructure", () => {
    const result = verifyPasswordResetFlow();
    expect(result.ok).toBe(true);
  });
});

describe("Rule 6 — Role login matrix", () => {
  it("redirects mustChangePassword users to change-password", () => {
    expect(resolvePostLoginRedirect(true)).toBe("/auth/change-password");
    expect(resolvePostLoginRedirect(false)).toBe("/");
    const result = verifyRoleLoginMatrix();
    expect(result.ok).toBe(true);
  });
});

describe("Rule 7 — Privilege escalation", () => {
  it("blocks manager activation and foreign password changes", () => {
    const result = verifyPrivilegeEscalationBlocked();
    expect(result.ok).toBe(true);
  });
});

describe("Rule 8 — Audit completeness", () => {
  it("covers all five authentication audit actions", () => {
    const coverage = buildAuthenticationAuditCoverageReport();
    expect(coverage.missing).toHaveLength(0);
    expect(coverage.covered.length).toBeGreaterThanOrEqual(5);
  });
});

describe("Rule 9 — Financial boundary", () => {
  it("finds no forbidden financial imports in auth layer", () => {
    expect(scanAuthFinancialBoundary()).toEqual([]);
  });
});

describe("Rule 10 — Architecture boundary", () => {
  it("finds no forbidden imports in auth modules", () => {
    expect(scanAuthArchitectureImports()).toEqual([]);
  });
});

describe("Rule 11 — Performance", () => {
  it("measures auth query surface structurally", () => {
    expect(countAuthQuerySurface()).toBeGreaterThan(0);
  });
});

describe("Rule 12 — Session security", () => {
  it("verifies session lifecycle and mustChangePassword signals", () => {
    const result = verifySessionSecurity();
    expect(result.ok).toBe(true);
  });
});

describe("Token and replay protection signals", () => {
  it("detects replay protection in activation and reset services", () => {
    expect(verifyReplayProtectionSignals().ok).toBe(true);
  });

  it("detects expiry rejection in activation and reset services", () => {
    expect(verifyExpiryRejectionSignals().ok).toBe(true);
  });

  it("exports invalid token error types", () => {
    expect(verifyInvalidTokenRejection().ok).toBe(true);
  });

  it("isolates public auth routes from dashboard", () => {
    expect(verifyPublicAuthRouteIsolation().ok).toBe(true);
  });
});

describe("Full certification run", () => {
  it("runs all checks with zero critical failures", async () => {
    const { checks } = await runAllAuthenticationCertificationChecks();
    const criticalFailures = checks.filter(
      (check) => !check.passed && check.severity === "critical",
    );
    expect(criticalFailures).toHaveLength(0);
  });

  it("produces production-ready score >= 9.0", async () => {
    const { result } = await buildAuthenticationCertificationResult();
    expect(result.overallScore).toBeGreaterThanOrEqual(9.0);
    expect(result.productionReady).toBe(true);
    expect(result.phase10dApproved).toBe(true);
  });

  it("aggregates subsystem scores", async () => {
    const { checks } = await runAllAuthenticationCertificationChecks();
    const subsystems = aggregateSubsystemStatuses(checks);
    expect(subsystems.passwordSecurity.passed).toBe(true);
    expect(subsystems.tokenSecurity.passed).toBe(true);
    expect(subsystems.sessionSecurity.passed).toBe(true);
    expect(subsystems.financialBoundary.passed).toBe(true);
    expect(subsystems.architecture.passed).toBe(true);
  });

  it("computes overall score from checks", async () => {
    const { checks } = await runAllAuthenticationCertificationChecks();
    const totals = computeOverallScore(checks);
    expect(totals.failedChecks).toBe(0);
    expect(totals.productionReady).toBe(true);
  });

  it("builds executive summary report", async () => {
    const report = await runAuthenticationCertificationWithReport();
    const summary = buildAuthenticationCertificationExecutiveSummary(report);
    expect(summary.join("\n")).toContain("PHASE_10D");
    expect(summary.join("\n")).toContain("Authentication Audit Coverage");
  });
});
