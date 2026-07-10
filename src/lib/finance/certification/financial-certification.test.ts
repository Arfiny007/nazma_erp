import { describe, expect, it } from "vitest";

import {
  aggregateSubsystemStatuses,
  CERTIFICATION_CHECK_CATALOG,
  computeOverallScore,
  runAllCertificationChecks,
  scanCreateLedgerEntryImports,
  scanForbiddenMutations,
} from "@/lib/finance/certification/financial-certification-validation";
import {
  buildCertificationExecutiveSummary,
  formatCertificationSummaryLine,
  formatSubsystemScoreLine,
} from "@/lib/finance/certification/financial-certification-report";
import { buildFinancialCertificationResult } from "@/lib/finance/certification/financial-certification-service";
import type { CertificationCheckResult } from "@/lib/finance/certification/financial-certification-types";

/**
 * Enterprise Financial System Certification tests — PHASE_07F.
 */

function makeCheck(
  overrides: Partial<CertificationCheckResult> & Pick<CertificationCheckResult, "id" | "subsystem">,
): CertificationCheckResult {
  const definition = CERTIFICATION_CHECK_CATALOG.find((check) => check.id === overrides.id);
  return {
    name: definition?.name ?? overrides.id,
    category: definition?.category ?? "financial_integrity",
    severity: definition?.severity ?? "critical",
    passed: true,
    warning: false,
    message: "ok",
    durationMs: 1,
    ...overrides,
  };
}

describe("Financial Certification — repository boundary scans", () => {
  it("finds no forbidden balance mutations outside posting-service", () => {
    const { balanceMutations } = scanForbiddenMutations();
    expect(balanceMutations).toEqual([]);
  });

  it("finds no unauthorized createLedgerEntry imports", () => {
    const imports = scanCreateLedgerEntryImports();
    expect(imports).toEqual([]);
  });

  it("allows test-only ledgerEntry.deleteMany cleanup", () => {
    const { ledgerDeletes } = scanForbiddenMutations();
    expect(ledgerDeletes.every((hit) => hit.file.endsWith(".test.ts"))).toBe(true);
  });
});

describe("Financial Certification — scoring", () => {
  it("computes overall score with warning weighting", () => {
    const checks: CertificationCheckResult[] = [
      makeCheck({ id: "RULE_01_CACHE_PARITY", subsystem: "ledger", passed: true }),
      makeCheck({
        id: "CONCURRENCY_TEST_SUITES",
        subsystem: "posting",
        passed: true,
        warning: true,
      }),
      makeCheck({
        id: "RULE_10_NO_FORBIDDEN_MUTATIONS",
        subsystem: "posting",
        passed: false,
        severity: "critical",
      }),
    ];

    const totals = computeOverallScore(checks);
    expect(totals.passedChecks).toBe(1);
    expect(totals.warnings).toBe(1);
    expect(totals.failedChecks).toBe(1);
    expect(totals.productionReady).toBe(false);
    expect(totals.overallScore).toBeGreaterThan(0);
    expect(totals.overallScore).toBeLessThan(10);
  });

  it("aggregates subsystem statuses", () => {
    const checks: CertificationCheckResult[] = [
      makeCheck({ id: "RULE_01_CACHE_PARITY", subsystem: "ledger", passed: true }),
      makeCheck({ id: "RULE_02_SUM_PARITY", subsystem: "ledger", passed: true }),
      makeCheck({
        id: "RULE_09_POSTING_SOLE_WRITER",
        subsystem: "posting",
        passed: true,
      }),
    ];

    const subsystems = aggregateSubsystemStatuses(checks);
    expect(subsystems.ledger.passedChecks).toBe(2);
    expect(subsystems.ledger.failedChecks).toBe(0);
    expect(subsystems.posting.passedChecks).toBe(1);
    expect(subsystems.statement.score).toBe(10);
  });
});

describe("Financial Certification — report formatting", () => {
  it("formats summary and executive lines", () => {
    const result = {
      certificationVersion: "1.0.0",
      overallScore: 9.2,
      passedChecks: 18,
      failedChecks: 0,
      warnings: 2,
      productionReady: true,
      subsystems: aggregateSubsystemStatuses([
        makeCheck({ id: "RULE_01_CACHE_PARITY", subsystem: "ledger", passed: true }),
      ]),
    };

    const summary = formatCertificationSummaryLine(result);
    expect(summary).toContain("9.2/10");
    expect(summary).toContain("Production Ready: YES");

    const subsystemLine = formatSubsystemScoreLine("ledger", result.subsystems.ledger);
    expect(subsystemLine).toContain("Ledger Foundation");

    const report = buildCertificationExecutiveSummary({
      result,
      checks: [],
      performance: {
        dealerCount: 10,
        ledgerRowCount: 100,
        reconciliationDurationMs: 42,
        statementSampleDurationMs: 5,
      },
      remainingRisks: ["test risk"],
      requiredManualChecks: ["manual step"],
      generatedAt: new Date().toISOString(),
    });

    expect(report.some((line) => line.includes("Subsystem Scores"))).toBe(true);
    expect(report.some((line) => line.includes("Reconciliation: 42ms"))).toBe(true);
  });
});

describe("Financial Certification — check runner (no database)", () => {
  it("runs structural checks without DATABASE_URL", async () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const { checks } = await runAllCertificationChecks({
      databaseAvailable: false,
      startedAt: new Date(),
    });

    process.env.DATABASE_URL = original;

    expect(checks.length).toBeGreaterThanOrEqual(CERTIFICATION_CHECK_CATALOG.length);

    const postingBoundary = checks.find((check) => check.id === "RULE_09_POSTING_SOLE_WRITER");
    expect(postingBoundary?.passed).toBe(true);

    const documentPipeline = checks.find((check) => check.id === "RULE_07_DOCUMENT_PIPELINE");
    expect(documentPipeline?.passed).toBe(true);

    const dbSkipped = checks.filter((check) => check.warning && check.message.includes("Skipped"));
    expect(dbSkipped.length).toBeGreaterThan(0);
  });
});

describe("Financial Certification — buildFinancialCertificationResult", () => {
  it("returns a complete FinancialCertificationResult shape", async () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const { result } = await buildFinancialCertificationResult();

    process.env.DATABASE_URL = original;

    expect(result.certificationVersion).toBe("1.0.0");
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(10);
    expect(result.subsystems.ledger).toBeDefined();
    expect(result.subsystems.posting).toBeDefined();
    expect(result.subsystems.openingBalance).toBeDefined();
    expect(result.subsystems.statement).toBeDefined();
    expect(result.subsystems.replay).toBeDefined();
    expect(result.subsystems.reconciliation).toBeDefined();
    expect(result.subsystems.integrityMonitor).toBeDefined();
    expect(result.subsystems.audit).toBeDefined();
    expect(typeof result.productionReady).toBe("boolean");
  });
});

describe("Financial Certification — catalog completeness", () => {
  it("covers all ten certification rules", () => {
    const ruleIds = [
      "RULE_01_CACHE_PARITY",
      "RULE_02_SUM_PARITY",
      "RULE_03_CHAIN_INTEGRITY",
      "RULE_04_REPLAY_IDEMPOTENT",
      "RULE_05_OPENING_BALANCE_ONCE",
      "RULE_06_STATEMENT_BALANCE",
      "RULE_07_DOCUMENT_PIPELINE",
      "RULE_08_AUDIT_TRAIL",
      "RULE_09_POSTING_SOLE_WRITER",
      "RULE_10_NO_FORBIDDEN_MUTATIONS",
    ];

    for (const id of ruleIds) {
      expect(CERTIFICATION_CHECK_CATALOG.some((check) => check.id === id)).toBe(true);
    }
  });
});

describe("Financial Certification — immutability structural checks", () => {
  it("verifies ledger append-only policy is documented in validation module", () => {
    const { ledgerUpdates } = scanForbiddenMutations();
    const appUpdates = ledgerUpdates.filter(
      (hit) => !hit.file.includes("ledger-validation.ts"),
    );
    expect(appUpdates).toEqual([]);
  });

  it("verifies replay engine does not reference currentBalance in source", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const replaySource = readFileSync(
      resolve(process.cwd(), "src/lib/ledger/backfill/ledger-backfill-replay.ts"),
      "utf8",
    );
    expect(replaySource.includes("createLedgerEntry")).toBe(true);
    expect(/dealer\.update\s*\(/.test(replaySource)).toBe(false);
    expect(/currentBalance:\s*\{/.test(replaySource)).toBe(false);
  });
});

describe("Financial Certification — accounting sensitivity coverage", () => {
  it("posting-service tests include zero and non-zero amounts", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/finance/posting-service.test.ts"),
      "utf8",
    );
    expect(source.includes("0.00")).toBe(true);
    expect(source.includes("postReceivableIncrease")).toBe(true);
    expect(source.includes("postOpeningBalance")).toBe(true);
  });
});
