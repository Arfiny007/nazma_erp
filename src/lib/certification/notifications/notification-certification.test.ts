import { describe, expect, it } from "vitest";

import {
  aggregateSubsystemStatuses,
  buildNotificationAuditCoverageReport,
  buildNotificationCertificationExecutiveSummary,
  buildNotificationCertificationResult,
  computeOverallScore,
  countNotificationQuerySurface,
  NOTIFICATION_CERTIFICATION_CHECK_CATALOG,
  runAllNotificationCertificationChecks,
  runNotificationCertificationWithReport,
  scanAuthProviderIsolation,
  scanNotificationArchitectureImports,
  scanNotificationFinancialBoundary,
  verifyAuthIntegrationChains,
  verifyBoundedMemorySignals,
  verifyDeliveryAttemptImmutability,
  verifyManagePermissionSuperAdminOnly,
  verifyNotificationActionPermissions,
  verifyNotificationSecurity,
  verifyQueueLifecycleIntegrity,
  verifyQueueSafety,
  verifyRetryPolicy,
  verifySmtpAbstraction,
} from "@/lib/certification/notifications";

/**
 * Enterprise Notification Certification tests — PHASE_11D.
 */

describe("Notification Certification — catalog", () => {
  it("defines checks for all 12 certification rules", () => {
    const ruleNumbers = NOTIFICATION_CERTIFICATION_CHECK_CATALOG.filter(
      (check) => check.ruleNumber !== undefined,
    ).map((check) => check.ruleNumber);

    expect([...ruleNumbers].sort((a, b) => a! - b!)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });
});

describe("Rule 1 — Notification immutability", () => {
  it("verifies append-only delivery attempts", () => {
    const result = verifyDeliveryAttemptImmutability();
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
  });
});

describe("Rule 2 — Queue integrity", () => {
  it("guards lifecycle transitions and rejects illegal paths", () => {
    const result = verifyQueueLifecycleIntegrity();
    expect(result.ok).toBe(true);
  });
});

describe("Rule 3 — Retry policy", () => {
  it("verifies immediate → +5m → +30m → permanent FAILED", () => {
    const result = verifyRetryPolicy();
    expect(result.ok).toBe(true);
  });
});

describe("Rule 4 — Provider isolation", () => {
  it("finds no SMTP or provider calls in auth/user modules", () => {
    expect(scanAuthProviderIsolation()).toEqual([]);
  });
});

describe("Rule 5 — Authentication integration", () => {
  it("verifies activation and password reset audit chains", () => {
    const result = verifyAuthIntegrationChains();
    expect(result.ok).toBe(true);
  });
});

describe("Rule 6 — Notification security", () => {
  it("verifies disabled/archived rejection and resend restrictions", () => {
    const result = verifyNotificationSecurity();
    expect(result.ok).toBe(true);
  });

  it("protects all notification server actions", () => {
    const result = verifyNotificationActionPermissions();
    expect(result.ok).toBe(true);
  });

  it("restricts notifications:manage to Super_Admin", () => {
    const result = verifyManagePermissionSuperAdminOnly();
    expect(result.ok).toBe(true);
  });
});

describe("Rule 7 — Queue safety", () => {
  it("verifies batch claim, stale recovery, and idempotency signals", () => {
    const result = verifyQueueSafety();
    expect(result.ok).toBe(true);
  });
});

describe("Rule 8 — SMTP abstraction", () => {
  it("verifies provider factory and nodemailer isolation", () => {
    const result = verifySmtpAbstraction();
    expect(result.ok).toBe(true);
  });
});

describe("Rule 9 — Financial boundary", () => {
  it("finds no forbidden financial imports in notification layer", () => {
    expect(scanNotificationFinancialBoundary()).toEqual([]);
  });
});

describe("Rule 10 — Audit completeness", () => {
  it("covers all ten notification audit actions", () => {
    const coverage = buildNotificationAuditCoverageReport();
    expect(coverage.missing).toHaveLength(0);
    expect(coverage.covered.length).toBeGreaterThanOrEqual(10);
  });
});

describe("Rule 11 — Architecture boundary", () => {
  it("finds no forbidden imports in notification modules", () => {
    expect(scanNotificationArchitectureImports()).toEqual([]);
  });
});

describe("Rule 12 — Performance", () => {
  it("measures notification query surface structurally", () => {
    expect(countNotificationQuerySurface()).toBeGreaterThan(0);
  });

  it("confirms bounded memory via page size cap", () => {
    expect(verifyBoundedMemorySignals()).toBe(true);
  });
});

describe("Full certification run", () => {
  it("runs all checks with zero critical failures", async () => {
    const { checks } = await runAllNotificationCertificationChecks();
    const criticalFailures = checks.filter(
      (check) => !check.passed && check.severity === "critical",
    );
    expect(criticalFailures).toHaveLength(0);
  });

  it("produces production-ready score >= 9.0", async () => {
    const { result } = await buildNotificationCertificationResult();
    expect(result.overallScore).toBeGreaterThanOrEqual(9.0);
    expect(result.productionReady).toBe(true);
    expect(result.phase11dApproved).toBe(true);
  });

  it("aggregates subsystem scores", async () => {
    const { checks } = await runAllNotificationCertificationChecks();
    const subsystems = aggregateSubsystemStatuses(checks);
    expect(subsystems.queueIntegrity.passed).toBe(true);
    expect(subsystems.providerArchitecture.passed).toBe(true);
    expect(subsystems.authenticationIntegration.passed).toBe(true);
    expect(subsystems.financialBoundary.passed).toBe(true);
    expect(subsystems.architecture.passed).toBe(true);
    expect(subsystems.notificationSecurity.passed).toBe(true);
  });

  it("computes overall score from checks", async () => {
    const { checks } = await runAllNotificationCertificationChecks();
    const totals = computeOverallScore(checks);
    expect(totals.failedChecks).toBe(0);
    expect(totals.productionReady).toBe(true);
  });

  it("builds executive summary report", async () => {
    const report = await runNotificationCertificationWithReport();
    const summary = buildNotificationCertificationExecutiveSummary(report);
    expect(summary.join("\n")).toContain("PHASE_11D");
    expect(summary.join("\n")).toContain("Notification Audit Coverage");
  });
});
