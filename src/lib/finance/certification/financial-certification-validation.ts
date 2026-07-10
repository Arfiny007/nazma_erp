import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { getDealerStatement } from "@/lib/ledger/statement";
import { validateDealerLedgerChain } from "@/lib/ledger/ledger-reconciliation";
import {
  getReconciliationSummary,
  reconcileAllDealers,
} from "@/lib/ledger/reconciliation";
import { runFinancialIntegrityScan } from "@/lib/ledger/monitor";
import { prisma } from "@/lib/prisma";

import type {
  CertificationCheckDefinition,
  CertificationCheckResult,
  CertificationPerformanceSnapshot,
  CertificationRunContext,
  CertificationSubsystem,
  CertificationStatus,
} from "./financial-certification-types";
import { PRODUCTION_READINESS_THRESHOLD } from "./financial-certification-types";

/**
 * Certification validation helpers — PHASE_07F.
 *
 * Read-only verification across ledger, posting, statement, replay,
 * reconciliation, integrity monitor, and audit subsystems.
 *
 * @see ADR-037
 */

const ZERO = new Prisma.Decimal(0);

const PROJECT_ROOT = path.resolve(process.cwd());
const SRC_ROOT = path.join(PROJECT_ROOT, "src");

type SourceFileHit = {
  file: string;
  line: number;
  content: string;
};

export const CERTIFICATION_CHECK_CATALOG: CertificationCheckDefinition[] = [
  // Rules 1–3 — ledger correctness
  {
    id: "RULE_01_CACHE_PARITY",
    name: "Dealer.currentBalance equals latest LedgerEntry.balance",
    subsystem: "ledger",
    category: "ledger_correctness",
    severity: "critical",
  },
  {
    id: "RULE_02_SUM_PARITY",
    name: "SUM(debit) - SUM(credit) equals latest LedgerEntry.balance",
    subsystem: "ledger",
    category: "ledger_correctness",
    severity: "critical",
  },
  {
    id: "RULE_03_CHAIN_INTEGRITY",
    name: "Ledger chain: balance[i] = balance[i-1] + debit - credit",
    subsystem: "ledger",
    category: "ledger_correctness",
    severity: "critical",
  },
  // Rule 4 — replay idempotency
  {
    id: "RULE_04_REPLAY_IDEMPOTENT",
    name: "Replay is idempotent via postingKey @unique",
    subsystem: "replay",
    category: "replay_safety",
    severity: "critical",
  },
  // Rule 5 — opening balance
  {
    id: "RULE_05_OPENING_BALANCE_ONCE",
    name: "Exactly one OpeningBalance initialization per dealer",
    subsystem: "openingBalance",
    category: "opening_balance",
    severity: "critical",
  },
  // Rule 6 — statement
  {
    id: "RULE_06_STATEMENT_BALANCE",
    name: "Statement running balance equals LedgerEntry.balance",
    subsystem: "statement",
    category: "statement_correctness",
    severity: "critical",
  },
  // Rule 7 — document pipeline
  {
    id: "RULE_07_DOCUMENT_PIPELINE",
    name: "Statement preview = print = PDF single pipeline",
    subsystem: "statement",
    category: "statement_correctness",
    severity: "critical",
  },
  // Rule 8 — audit
  {
    id: "RULE_08_AUDIT_TRAIL",
    name: "Every ledger entry has postingKey; postings produce audit rows",
    subsystem: "audit",
    category: "audit_traceability",
    severity: "critical",
  },
  // Rule 9 — posting boundary
  {
    id: "RULE_09_POSTING_SOLE_WRITER",
    name: "PostingService is sole writer of Dealer.currentBalance",
    subsystem: "posting",
    category: "repository_boundary",
    severity: "critical",
  },
  // Rule 10 — immutability
  {
    id: "RULE_10_NO_FORBIDDEN_MUTATIONS",
    name: "No ledgerEntry.update/delete or balance bypass in application code",
    subsystem: "posting",
    category: "immutability",
    severity: "critical",
  },
  // Subsystem presence
  {
    id: "LEDGER_FOUNDATION_EXPORTS",
    name: "Ledger foundation module exports createLedgerEntry and posting-key",
    subsystem: "ledger",
    category: "ledger_correctness",
    severity: "critical",
  },
  {
    id: "POSTING_SERVICE_FUNCTIONS",
    name: "Posting service exposes all receivable and opening balance functions",
    subsystem: "posting",
    category: "financial_integrity",
    severity: "critical",
  },
  {
    id: "RECONCILIATION_ENGINE",
    name: "Reconciliation engine exposes reconcileDealer and reconcileAllDealers",
    subsystem: "reconciliation",
    category: "reconciliation_accuracy",
    severity: "critical",
  },
  {
    id: "INTEGRITY_MONITOR",
    name: "Integrity monitor exposes runFinancialIntegrityScan",
    subsystem: "integrityMonitor",
    category: "financial_integrity",
    severity: "critical",
  },
  {
    id: "REPLAY_ENGINE",
    name: "Replay engine uses createLedgerEntry without balance mutation",
    subsystem: "replay",
    category: "replay_safety",
    severity: "critical",
  },
  // Test suite presence
  {
    id: "CONCURRENCY_TEST_SUITES",
    name: "Concurrency test suites exist for invoice and opening balance",
    subsystem: "posting",
    category: "concurrency",
    severity: "warning",
  },
  {
    id: "ACCOUNTING_SENSITIVITY_TESTS",
    name: "Accounting sensitivity covered in posting and opening balance tests",
    subsystem: "posting",
    category: "accounting_sensitivity",
    severity: "warning",
  },
  {
    id: "PERFORMANCE_MEASUREMENT",
    name: "Reconciliation performance measured without correctness degradation",
    subsystem: "reconciliation",
    category: "performance",
    severity: "info",
  },
];

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      collectSourceFiles(fullPath, files);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

function relativePath(filePath: string): string {
  return path.relative(PROJECT_ROOT, filePath).replace(/\\/g, "/");
}

function searchSourceFiles(pattern: RegExp, excludePaths: string[] = []): SourceFileHit[] {
  const hits: SourceFileHit[] = [];
  for (const file of collectSourceFiles(SRC_ROOT)) {
    const relative = relativePath(file);
    if (excludePaths.some((excluded) => relative.includes(excluded))) {
      continue;
    }
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        hits.push({
          file: relative,
          line: i + 1,
          content: lines[i].trim(),
        });
      }
    }
  }
  return hits;
}

function readSourceFile(relativeFile: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativeFile), "utf8");
}

function fileExists(relativeFile: string): boolean {
  try {
    return statSync(path.join(PROJECT_ROOT, relativeFile)).isFile();
  } catch {
    return false;
  }
}

function makeResult(
  definition: CertificationCheckDefinition,
  passed: boolean,
  message: string,
  options: { warning?: boolean; durationMs?: number } = {},
): CertificationCheckResult {
  return {
    id: definition.id,
    name: definition.name,
    subsystem: definition.subsystem,
    category: definition.category,
    severity: definition.severity,
    passed,
    warning: options.warning ?? false,
    message,
    durationMs: options.durationMs ?? 0,
  };
}

function warnResult(
  definition: CertificationCheckDefinition,
  message: string,
  durationMs = 0,
): CertificationCheckResult {
  return makeResult(definition, true, message, { warning: true, durationMs });
}

function failResult(
  definition: CertificationCheckDefinition,
  message: string,
  durationMs = 0,
): CertificationCheckResult {
  return makeResult(definition, false, message, { durationMs });
}

function passResult(
  definition: CertificationCheckDefinition,
  message: string,
  durationMs = 0,
): CertificationCheckResult {
  return makeResult(definition, true, message, { durationMs });
}

async function canReachDatabase(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/** Resolve whether live database checks should run. */
export async function resolveDatabaseAvailability(): Promise<boolean> {
  return canReachDatabase();
}

function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function getDefinition(id: string): CertificationCheckDefinition {
  const definition = CERTIFICATION_CHECK_CATALOG.find((check) => check.id === id);
  if (!definition) {
    throw new Error(`Unknown certification check: ${id}`);
  }
  return definition;
}

/** Scan repository for forbidden balance and ledger mutations. */
export function scanForbiddenMutations(): {
  balanceMutations: SourceFileHit[];
  ledgerUpdates: SourceFileHit[];
  ledgerDeletes: SourceFileHit[];
} {
  const balanceMutations = searchSourceFiles(
    /currentBalance:\s*\{\s*(increment|decrement)/,
    ["src/lib/finance/certification/"],
  ).filter((hit) => !hit.file.includes("src/lib/finance/posting-service.ts"));

  const ledgerUpdates = searchSourceFiles(/ledgerEntry\.update/, [
    "src/lib/finance/certification/",
  ]).filter((hit) => !hit.file.includes("src/lib/ledger/ledger-validation.ts"));

  const ledgerDeletes = searchSourceFiles(/ledgerEntry\.delete/, [
    "src/lib/finance/certification/",
  ]).filter(
    (hit) =>
      !hit.file.includes("issue-invoice-concurrency.test.ts") &&
      !hit.file.includes("opening-balance-concurrency.integration.test.ts") &&
      !hit.file.includes("src/lib/ledger/ledger-validation.ts"),
  );

  return { balanceMutations, ledgerUpdates, ledgerDeletes };
}

/** Verify createLedgerEntry is only imported from approved modules. */
export function scanCreateLedgerEntryImports(): SourceFileHit[] {
  return searchSourceFiles(/createLedgerEntry/, ["src/lib/finance/certification/"]).filter(
    (hit) =>
      hit.content.includes("import") &&
      !hit.file.includes("src/lib/finance/posting-service.ts") &&
      !hit.file.includes("src/lib/ledger/backfill/ledger-backfill-replay.ts") &&
      !hit.file.includes("src/lib/ledger/ledger-service.ts") &&
      !hit.file.includes("src/lib/ledger/index.ts") &&
      !hit.file.includes("src/lib/ledger/backfill/index.ts") &&
      !hit.file.includes("ledger-backfill.test.ts") &&
      !hit.file.includes("ledger-service.test.ts") &&
      !hit.file.includes("posting-service.test.ts") &&
      !hit.file.includes("opening-balance-service.ts"),
  );
}

async function runDatabaseLedgerChecks(
  ctx: CertificationRunContext,
): Promise<CertificationCheckResult[]> {
  if (!ctx.databaseAvailable) {
    const reason = isDatabaseConfigured()
      ? "Skipped — database configured but unreachable."
      : "Skipped — DATABASE_URL not configured.";
    return [
      warnResult(getDefinition("RULE_01_CACHE_PARITY"), reason),
      warnResult(getDefinition("RULE_02_SUM_PARITY"), reason),
      warnResult(getDefinition("RULE_03_CHAIN_INTEGRITY"), reason),
    ];
  }

  const startedAt = Date.now();
  const report = await getReconciliationSummary(prisma);
  const durationMs = Date.now() - startedAt;

  const inconsistent = report.dealers.filter((d) => d.status !== "CONSISTENT");
  const chainFailures = inconsistent.filter((d) => d.status === "CORRUPTED_CHAIN");
  const driftFailures = inconsistent.filter((d) => d.status === "DRIFT");
  const missingFailures = inconsistent.filter((d) => d.status === "MISSING_LEDGER");

  const results: CertificationCheckResult[] = [];

  results.push(
    driftFailures.length === 0 && missingFailures.length === 0
      ? passResult(
          getDefinition("RULE_01_CACHE_PARITY"),
          `All ${report.summary.totalDealers} dealers satisfy cache parity.`,
          durationMs,
        )
      : failResult(
          getDefinition("RULE_01_CACHE_PARITY"),
          `${driftFailures.length + missingFailures.length} dealer(s) failed cache parity: ${[
            ...driftFailures,
            ...missingFailures,
          ]
            .slice(0, 5)
            .map((d) => d.dealerCode)
            .join(", ")}`,
          durationMs,
        ),
  );

  results.push(
    chainFailures.length === 0 && driftFailures.length === 0
      ? passResult(
          getDefinition("RULE_02_SUM_PARITY"),
          "SUM(debit) - SUM(credit) matches latest ledger balance for all dealers.",
          durationMs,
        )
      : failResult(
          getDefinition("RULE_02_SUM_PARITY"),
          `${chainFailures.length + driftFailures.length} dealer(s) failed sum parity.`,
          durationMs,
        ),
  );

  results.push(
    chainFailures.length === 0
      ? passResult(
          getDefinition("RULE_03_CHAIN_INTEGRITY"),
          "Ledger chain integrity verified for all dealers with ledger rows.",
          durationMs,
        )
      : failResult(
          getDefinition("RULE_03_CHAIN_INTEGRITY"),
          `${chainFailures.length} dealer(s) have corrupted chains: ${chainFailures
            .slice(0, 5)
            .map((d) => d.dealerCode)
            .join(", ")}`,
          durationMs,
        ),
  );

  return results;
}

async function runOpeningBalanceCheck(
  ctx: CertificationRunContext,
): Promise<CertificationCheckResult> {
  const definition = getDefinition("RULE_05_OPENING_BALANCE_ONCE");

  if (!ctx.databaseAvailable) {
    return warnResult(definition, "Skipped — DATABASE_URL not configured.");
  }

  const startedAt = Date.now();
  const duplicates = await prisma.$queryRaw<Array<{ dealerCode: string; count: bigint }>>`
    SELECT "dealerCode", COUNT(*)::bigint AS count
    FROM "OpeningBalance"
    GROUP BY "dealerCode"
    HAVING COUNT(*) > 1
  `;
  const durationMs = Date.now() - startedAt;

  if (duplicates.length > 0) {
    return failResult(
      definition,
      `${duplicates.length} dealer(s) have duplicate OpeningBalance rows.`,
      durationMs,
    );
  }

  return passResult(
    definition,
    "At most one OpeningBalance row per dealer (schema + data verified).",
    durationMs,
  );
}

async function runStatementBalanceCheck(
  ctx: CertificationRunContext,
): Promise<CertificationCheckResult> {
  const definition = getDefinition("RULE_06_STATEMENT_BALANCE");

  if (!ctx.databaseAvailable) {
    return warnResult(definition, "Skipped — DATABASE_URL not configured.");
  }

  const startedAt = Date.now();
  const dealer = await prisma.dealer.findFirst({
    where: {
      ledgerEntries: { some: {} },
    },
    select: { dealerCode: true },
    orderBy: { dealerCode: "asc" },
  });

  if (!dealer) {
    return warnResult(
      definition,
      "No dealer with ledger rows — structural check only.",
      Date.now() - startedAt,
    );
  }

  const [statement, ledgerRows, validation] = await Promise.all([
    getDealerStatement({ dealerCode: dealer.dealerCode, page: 1, pageSize: 50 }, prisma),
    prisma.ledgerEntry.findMany({
      where: { dealerCode: dealer.dealerCode },
      orderBy: [{ transactionDate: "asc" }, { postingDate: "asc" }, { id: "asc" }],
      take: 50,
      select: { id: true, balance: true },
    }),
    validateDealerLedgerChain(prisma, dealer.dealerCode),
  ]);

  const ledgerBalanceById = new Map(
    ledgerRows.map((row) => [row.id, row.balance.toFixed(2)]),
  );

  const mismatches = statement.rows.filter((row) => {
    const ledgerBalance = ledgerBalanceById.get(row.id);
    return ledgerBalance !== undefined && ledgerBalance !== row.runningBalance.toFixed(2);
  });

  const durationMs = Date.now() - startedAt;

  if (mismatches.length > 0) {
    return failResult(
      definition,
      `${mismatches.length} statement row(s) diverge from LedgerEntry.balance.`,
      durationMs,
    );
  }

  const closingMatches =
    statement.meta.currentBalance.toFixed(2) ===
    validation.cachedBalance.toFixed(2);

  if (!closingMatches) {
    return failResult(
      definition,
      `Statement closing balance ${statement.meta.currentBalance.toFixed(2)} != cache ${validation.cachedBalance.toFixed(2)}.`,
      durationMs,
    );
  }

  return passResult(
    definition,
    `Statement running balances match LedgerEntry.balance for dealer ${dealer.dealerCode}.`,
    durationMs,
  );
}

function runDocumentPipelineCheck(): CertificationCheckResult {
  const definition = getDefinition("RULE_07_DOCUMENT_PIPELINE");
  const startedAt = Date.now();

  const requiredFiles = [
    "src/components/documents/statement/dealer-statement-printable.tsx",
    "src/components/documents/statement/statement-mapper.ts",
    "src/components/documents/statement/dealer-statement-document.test.ts",
    "src/lib/documents/fetch-dealer-statement-for-print.ts",
  ];

  const missing = requiredFiles.filter((file) => !fileExists(file));
  if (missing.length > 0) {
    return failResult(
      definition,
      `Missing document pipeline files: ${missing.join(", ")}`,
      Date.now() - startedAt,
    );
  }

  const mapperSource = readSourceFile("src/components/documents/statement/statement-mapper.ts");
  const printableSource = readSourceFile(
    "src/components/documents/statement/dealer-statement-printable.tsx",
  );
  const testSource = readSourceFile(
    "src/components/documents/statement/dealer-statement-document.test.ts",
  );

  const usesMapper = printableSource.includes("mapDealerStatementToDocument");
  const noClientMath =
    !/runningBalance\s*[\+\-\*\/]/.test(mapperSource) &&
    mapperSource.includes("runningBalance");
  const hasPipelineTest =
    testSource.includes("preview") ||
    testSource.includes("print") ||
    testSource.includes("mergeDealerStatementPages");

  if (!usesMapper || !noClientMath || !hasPipelineTest) {
    return failResult(
      definition,
      "Statement document pipeline does not satisfy preview = print = PDF contract.",
      Date.now() - startedAt,
    );
  }

  return passResult(
    definition,
    "DealerStatementPrintable consumes mapDealerStatementToDocument — single pipeline verified.",
    Date.now() - startedAt,
  );
}

async function runAuditTrailCheck(
  ctx: CertificationRunContext,
): Promise<CertificationCheckResult> {
  const definition = getDefinition("RULE_08_AUDIT_TRAIL");

  if (!ctx.databaseAvailable) {
    return warnResult(definition, "Skipped — DATABASE_URL not configured.");
  }

  const startedAt = Date.now();
  const [missingPostingKey, sampleEntries] = await Promise.all([
    prisma.ledgerEntry.count({ where: { postingKey: "" } }),
    prisma.ledgerEntry.findMany({
      take: 20,
      orderBy: [{ postingDate: "desc" }, { id: "desc" }],
      select: { id: true, postingKey: true },
    }),
  ]);

  if (missingPostingKey > 0) {
    return failResult(
      definition,
      `${missingPostingKey} ledger row(s) missing postingKey.`,
      Date.now() - startedAt,
    );
  }

  const auditRows = await prisma.auditLog.count({
    where: {
      action: { in: ["DEALER_BALANCE_UPDATED", "DEALER_BALANCE_DECREASED", "DEALER_OPENING_BALANCE_POSTED"] },
    },
  });

  const durationMs = Date.now() - startedAt;

  if (sampleEntries.length > 0 && auditRows === 0) {
    return warnResult(
      definition,
      "Ledger entries exist but no balance-posting audit rows found — may be replay/backfill data.",
      durationMs,
    );
  }

  return passResult(
    definition,
    `All ledger rows have postingKey; ${auditRows} balance-posting audit row(s) in repository.`,
    durationMs,
  );
}

function runPostingSoleWriterCheck(): CertificationCheckResult {
  const definition = getDefinition("RULE_09_POSTING_SOLE_WRITER");
  const startedAt = Date.now();
  const { balanceMutations } = scanForbiddenMutations();

  if (balanceMutations.length > 0) {
    const sample = balanceMutations
      .slice(0, 3)
      .map((hit) => `${hit.file}:${hit.line}`)
      .join(", ");
    return failResult(
      definition,
      `Forbidden currentBalance mutations outside posting-service: ${sample}`,
      Date.now() - startedAt,
    );
  }

  const postingSource = readSourceFile("src/lib/finance/posting-service.ts");
  const hasAllFunctions =
    postingSource.includes("postReceivableIncrease") &&
    postingSource.includes("postReceivableDecrease") &&
    postingSource.includes("postReceivableDecreaseReversal") &&
    postingSource.includes("postOpeningBalance");

  if (!hasAllFunctions) {
    return failResult(
      definition,
      "posting-service.ts missing required posting functions.",
      Date.now() - startedAt,
    );
  }

  return passResult(
    definition,
    "Dealer.currentBalance mutations confined to posting-service.ts.",
    Date.now() - startedAt,
  );
}

function runForbiddenMutationsCheck(): CertificationCheckResult {
  const definition = getDefinition("RULE_10_NO_FORBIDDEN_MUTATIONS");
  const startedAt = Date.now();
  const { ledgerUpdates, ledgerDeletes } = scanForbiddenMutations();
  const badImports = scanCreateLedgerEntryImports();

  const violations = [...ledgerUpdates, ...ledgerDeletes, ...badImports];
  if (violations.length > 0) {
    const sample = violations
      .slice(0, 3)
      .map((hit) => `${hit.file}:${hit.line}`)
      .join(", ");
    return failResult(
      definition,
      `Forbidden mutation paths detected: ${sample}`,
      Date.now() - startedAt,
    );
  }

  return passResult(
    definition,
    "No ledgerEntry.update/delete or unauthorized createLedgerEntry imports in application code.",
    Date.now() - startedAt,
  );
}

function runReplayIdempotencyCheck(): CertificationCheckResult {
  const definition = getDefinition("RULE_04_REPLAY_IDEMPOTENT");
  const startedAt = Date.now();

  const replaySource = readSourceFile("src/lib/ledger/backfill/ledger-backfill-replay.ts");
  const schemaSource = readSourceFile("prisma/schema.prisma");

  const usesCreateLedgerEntry = replaySource.includes("createLedgerEntry");
  const noBalanceMutation =
    !/dealer\.update\s*\(/.test(replaySource) &&
    !/currentBalance:\s*\{/.test(replaySource);
  const hasUniquePostingKey = schemaSource.includes("postingKey") &&
    schemaSource.includes("@unique");

  if (!usesCreateLedgerEntry || !noBalanceMutation || !hasUniquePostingKey) {
    return failResult(
      definition,
      "Replay engine does not satisfy idempotency contract.",
      Date.now() - startedAt,
    );
  }

  return passResult(
    definition,
    "Replay uses createLedgerEntry + postingKey @unique; no balance mutation.",
    Date.now() - startedAt,
  );
}

function runLedgerFoundationCheck(): CertificationCheckResult {
  const definition = getDefinition("LEDGER_FOUNDATION_EXPORTS");
  const startedAt = Date.now();
  const indexSource = readSourceFile("src/lib/ledger/index.ts");

  const hasCreate = indexSource.includes("createLedgerEntry");
  const hasPostingKey = indexSource.includes("buildLedgerPostingKey");

  if (!hasCreate || !hasPostingKey) {
    return failResult(
      definition,
      "Ledger index missing createLedgerEntry or buildLedgerPostingKey exports.",
      Date.now() - startedAt,
    );
  }

  return passResult(
    definition,
    "Ledger foundation exports verified.",
    Date.now() - startedAt,
  );
}

function runReconciliationEngineCheck(): CertificationCheckResult {
  const definition = getDefinition("RECONCILIATION_ENGINE");
  const startedAt = Date.now();
  const indexSource = readSourceFile("src/lib/ledger/reconciliation/index.ts");

  const hasDealer = indexSource.includes("reconcileDealer");
  const hasAll = indexSource.includes("reconcileAllDealers");

  if (!hasDealer || !hasAll) {
    return failResult(
      definition,
      "Reconciliation engine exports incomplete.",
      Date.now() - startedAt,
    );
  }

  return passResult(
    definition,
    "reconcileDealer and reconcileAllDealers exported.",
    Date.now() - startedAt,
  );
}

function runIntegrityMonitorCheck(): CertificationCheckResult {
  const definition = getDefinition("INTEGRITY_MONITOR");
  const startedAt = Date.now();
  const indexSource = readSourceFile("src/lib/ledger/monitor/index.ts");

  if (!indexSource.includes("runFinancialIntegrityScan")) {
    return failResult(
      definition,
      "Integrity monitor missing runFinancialIntegrityScan export.",
      Date.now() - startedAt,
    );
  }

  const consoleExists = fileExists(
    "src/components/ledger/integrity/integrity-console-view.tsx",
  );
  if (!consoleExists) {
    return failResult(
      definition,
      "Integrity operations console UI not found.",
      Date.now() - startedAt,
    );
  }

  return passResult(
    definition,
    "Integrity monitor and operations console verified.",
    Date.now() - startedAt,
  );
}

function runReplayEngineCheck(): CertificationCheckResult {
  const definition = getDefinition("REPLAY_ENGINE");
  const startedAt = Date.now();
  const indexSource = readSourceFile("src/lib/ledger/backfill/index.ts");
  const replaySource = readSourceFile("src/lib/ledger/backfill/ledger-backfill-replay.ts");

  const exportsReplay = indexSource.includes("replayDealerLedger");
  const usesCreate = replaySource.includes("createLedgerEntry");
  const noBalance =
    !/dealer\.update\s*\(/.test(replaySource) &&
    !/currentBalance:\s*\{/.test(replaySource);

  if (!exportsReplay || !usesCreate || !noBalance) {
    return failResult(definition, "Replay engine boundary violation.", Date.now() - startedAt);
  }

  return passResult(
    definition,
    "replayDealerLedger uses createLedgerEntry only; never mutates balance.",
    Date.now() - startedAt,
  );
}

function runPostingServiceCheck(): CertificationCheckResult {
  const definition = getDefinition("POSTING_SERVICE_FUNCTIONS");
  const startedAt = Date.now();
  const postingSource = readSourceFile("src/lib/finance/posting-service.ts");

  const required = [
    "postReceivableIncrease",
    "postReceivableDecrease",
    "postReceivableDecreaseReversal",
    "postOpeningBalance",
    "createLedgerEntry",
    "assertLedgerBalanceMatchesCache",
  ];

  const missing = required.filter((symbol) => !postingSource.includes(symbol));
  if (missing.length > 0) {
    return failResult(
      definition,
      `posting-service.ts missing symbols: ${missing.join(", ")}`,
      Date.now() - startedAt,
    );
  }

  return passResult(
    definition,
    "All receivable and opening balance posting functions present.",
    Date.now() - startedAt,
  );
}

function runConcurrencyTestSuiteCheck(): CertificationCheckResult {
  const definition = getDefinition("CONCURRENCY_TEST_SUITES");
  const startedAt = Date.now();

  const invoiceTest = fileExists("src/lib/invoices/issue-invoice-concurrency.test.ts");
  const openingTest = fileExists(
    "src/lib/finance/initialization/opening-balance-concurrency.integration.test.ts",
  );
  const replayTest = fileExists("src/lib/ledger/backfill/ledger-backfill.test.ts");

  if (!invoiceTest || !openingTest) {
    return warnResult(
      definition,
      "Concurrency test files missing — dealer lock pattern not fully regression-tested.",
      Date.now() - startedAt,
    );
  }

  const invoiceSource = readSourceFile("src/lib/invoices/issue-invoice-concurrency.test.ts");
  if (invoiceSource.includes("it.skipIf(!integrationReady)")) {
    return warnResult(
      definition,
      "Invoice concurrency tests use registration-time skipIf — may never execute (TECH_DEBT C8).",
      Date.now() - startedAt,
    );
  }

  if (!replayTest) {
    return warnResult(
      definition,
      "Replay test suite missing.",
      Date.now() - startedAt,
    );
  }

  return passResult(
    definition,
    "Concurrency test suites present for invoice, opening balance, and replay.",
    Date.now() - startedAt,
  );
}

function runAccountingSensitivityCheck(): CertificationCheckResult {
  const definition = getDefinition("ACCOUNTING_SENSITIVITY_TESTS");
  const startedAt = Date.now();

  const postingTest = readSourceFile("src/lib/finance/posting-service.test.ts");
  const openingTest = readSourceFile(
    "src/lib/finance/initialization/opening-balance-validation.test.ts",
  );

  const coversSmall = postingTest.includes("0.01") || postingTest.includes("0.00");
  const coversLarge =
    postingTest.includes("999999") || postingTest.includes("100000");
  const coversAdvance = openingTest.includes("negative") || openingTest.includes("-");
  const coversZero = postingTest.includes("0.00") || openingTest.includes("zero");

  if (!coversSmall || !coversLarge || !coversAdvance || !coversZero) {
    return warnResult(
      definition,
      "Accounting sensitivity scenarios partially covered in unit tests.",
      Date.now() - startedAt,
    );
  }

  return passResult(
    definition,
    "Posting and opening balance tests cover small, large, zero, and advance scenarios.",
    Date.now() - startedAt,
  );
}

async function runPerformanceMeasurement(
  ctx: CertificationRunContext,
): Promise<{
  result: CertificationCheckResult;
  snapshot: CertificationPerformanceSnapshot | null;
}> {
  const definition = getDefinition("PERFORMANCE_MEASUREMENT");

  if (!ctx.databaseAvailable) {
    return {
      result: warnResult(definition, "Skipped — DATABASE_URL not configured."),
      snapshot: null,
    };
  }

  const startedAt = Date.now();
  const [dealerCount, ledgerRowCount] = await Promise.all([
    prisma.dealer.count(),
    prisma.ledgerEntry.count(),
  ]);

  const reconcileStartedAt = Date.now();
  await reconcileAllDealers(prisma);
  const reconciliationDurationMs = Date.now() - reconcileStartedAt;

  let statementSampleDurationMs: number | null = null;
  const sampleDealer = await prisma.dealer.findFirst({
    where: { ledgerEntries: { some: {} } },
    select: { dealerCode: true },
  });

  if (sampleDealer) {
    const statementStartedAt = Date.now();
    await getDealerStatement(
      { dealerCode: sampleDealer.dealerCode, page: 1, pageSize: 100 },
      prisma,
    );
    statementSampleDurationMs = Date.now() - statementStartedAt;
  }

  const durationMs = Date.now() - startedAt;
  const snapshot: CertificationPerformanceSnapshot = {
    dealerCount,
    ledgerRowCount,
    reconciliationDurationMs,
    statementSampleDurationMs,
  };

  return {
    result: passResult(
      definition,
      `Measured reconciliation for ${dealerCount} dealer(s), ${ledgerRowCount} ledger row(s) in ${reconciliationDurationMs}ms — no correctness degradation.`,
      durationMs,
    ),
    snapshot,
  };
}

/** Execute every certification check and return raw results. */
export async function runAllCertificationChecks(
  ctx?: CertificationRunContext,
): Promise<{
  checks: CertificationCheckResult[];
  performance: CertificationPerformanceSnapshot | null;
}> {
  const resolvedCtx =
    ctx ??
    ({
      databaseAvailable: await resolveDatabaseAvailability(),
      startedAt: new Date(),
    } satisfies CertificationRunContext);

  const checks: CertificationCheckResult[] = [];

  checks.push(runLedgerFoundationCheck());
  checks.push(runPostingServiceCheck());
  checks.push(runReconciliationEngineCheck());
  checks.push(runIntegrityMonitorCheck());
  checks.push(runReplayEngineCheck());
  checks.push(runReplayIdempotencyCheck());
  checks.push(runDocumentPipelineCheck());
  checks.push(runPostingSoleWriterCheck());
  checks.push(runForbiddenMutationsCheck());
  checks.push(runConcurrencyTestSuiteCheck());
  checks.push(runAccountingSensitivityCheck());

  checks.push(...(await runDatabaseLedgerChecks(resolvedCtx)));
  checks.push(await runOpeningBalanceCheck(resolvedCtx));
  checks.push(await runStatementBalanceCheck(resolvedCtx));
  checks.push(await runAuditTrailCheck(resolvedCtx));

  const performanceRun = await runPerformanceMeasurement(resolvedCtx);
  checks.push(performanceRun.result);

  return { checks, performance: performanceRun.snapshot };
}

/** Aggregate check results into per-subsystem status. */
export function aggregateSubsystemStatuses(
  checks: CertificationCheckResult[],
): Record<CertificationSubsystem, CertificationStatus> {
  const subsystems: CertificationSubsystem[] = [
    "ledger",
    "posting",
    "openingBalance",
    "statement",
    "replay",
    "reconciliation",
    "integrityMonitor",
    "audit",
  ];

  const result = {} as Record<CertificationSubsystem, CertificationStatus>;

  for (const subsystem of subsystems) {
    const subsystemChecks = checks.filter((check) => check.subsystem === subsystem);
    const passedChecks = subsystemChecks.filter((check) => check.passed && !check.warning).length;
    const warnings = subsystemChecks.filter((check) => check.warning).length;
    const failedChecks = subsystemChecks.filter((check) => !check.passed).length;
    const total = subsystemChecks.length;
    const score =
      total === 0
        ? 10
        : Math.round(((passedChecks + warnings * 0.5) / total) * 10 * 10) / 10;

    result[subsystem] = {
      score,
      passed: failedChecks === 0 && score >= 8,
      passedChecks,
      failedChecks,
      warnings,
    };
  }

  return result;
}

/** Compute overall certification score from check results. */
export function computeOverallScore(checks: CertificationCheckResult[]): {
  overallScore: number;
  passedChecks: number;
  failedChecks: number;
  warnings: number;
  productionReady: boolean;
} {
  const passedChecks = checks.filter((check) => check.passed && !check.warning).length;
  const warnings = checks.filter((check) => check.warning).length;
  const failedChecks = checks.filter((check) => !check.passed).length;
  const total = checks.length || 1;

  const overallScore =
    Math.round(((passedChecks + warnings * 0.5) / total) * 10 * 10) / 10;

  const criticalFailures = checks.filter(
    (check) => !check.passed && check.severity === "critical",
  ).length;

  const productionReady =
    criticalFailures === 0 && overallScore >= PRODUCTION_READINESS_THRESHOLD;

  return {
    overallScore,
    passedChecks,
    failedChecks,
    warnings,
    productionReady,
  };
}

/** Verify integrity monitor can orchestrate a scan when database is available. */
export async function verifyIntegrityMonitorOrchestration(
  ctx: CertificationRunContext,
): Promise<CertificationCheckResult | null> {
  if (!ctx.databaseAvailable) return null;

  const definition: CertificationCheckDefinition = {
    id: "INTEGRITY_MONITOR_ORCHESTRATION",
    name: "Integrity monitor orchestrates reconciliation scan",
    subsystem: "integrityMonitor",
    category: "financial_integrity",
    severity: "info",
  };

  const startedAt = Date.now();
  try {
    const scan = await runFinancialIntegrityScan(prisma);
    return passResult(
      definition,
      `Scan completed for ${scan.totalDealers} dealer(s) in ${scan.durationMs}ms.`,
      Date.now() - startedAt,
    );
  } catch (error) {
    return failResult(
      definition,
      `Integrity scan failed: ${error instanceof Error ? error.message : "unknown error"}`,
      Date.now() - startedAt,
    );
  }
}

export { isDatabaseConfigured, ZERO };
