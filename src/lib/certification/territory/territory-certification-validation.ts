import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { InvoiceStatus, Prisma } from "@prisma/client";

import {
  accumulateInvoiceAging,
  classifyAgingBucket,
  computeDaysOverdue,
  getDueReport,
  resolveOwnershipAtDate,
  totalAgingAmount,
  type DueReportReadClient,
} from "@/lib/reports/due";
import {
  mergeCollectionTerritoryScope,
  mergeDealerTerritoryScope,
  mergeOrderTerritoryScope,
} from "@/lib/rbac/territory/territory-filters";
import {
  buildScopedTerritoryScope,
  isGlobalTerritoryRole,
  isScopedTerritoryRole,
  resolveTerritoryScopeMode,
  territoryIdMatchesScope,
} from "@/lib/rbac/territory/territory-rules";
import type { TerritoryScope } from "@/lib/rbac/territory/territory-types";
import { prisma } from "@/lib/prisma";

import type {
  AgingBalanceReconciliation,
  TerritoryCertificationCheckDefinition,
  TerritoryCertificationCheckResult,
  TerritoryCertificationRunContext,
  TerritoryCertificationStatus,
  TerritoryCertificationSubsystem,
} from "./territory-certification-types";
import { TERRITORY_PRODUCTION_READINESS_THRESHOLD } from "./territory-certification-types";

/**
 * Territory & Due Certification validation — PHASE_08E.
 *
 * Read-only verification across PHASE_08A–08D.
 *
 * @see ADR-041
 */

const ZERO = new Prisma.Decimal(0);
const PROJECT_ROOT = path.resolve(process.cwd());
const SRC_ROOT = path.join(PROJECT_ROOT, "src");

type SourceFileHit = {
  file: string;
  line: number;
  content: string;
};

const TERRITORY_SCOPED_ACTIONS = [
  "src/lib/actions/dealers/list-dealers.ts",
  "src/lib/actions/orders/list-orders.ts",
  "src/lib/actions/collections/list-collections.ts",
  "src/lib/actions/due-reports/get-due-report.ts",
  "src/lib/actions/due-reports/get-territory-due-report.ts",
  "src/lib/actions/due-reports/get-sr-due-report.ts",
  "src/lib/actions/due-reports/get-company-due-summary.ts",
  "src/lib/actions/due-reports/get-due-aging-report.ts",
] as const;

const TERRITORY_GATED_DETAIL_ACTIONS = [
  "src/lib/actions/dealers/get-dealer.ts",
  "src/lib/actions/orders/get-order.ts",
  "src/lib/actions/collections/get-collection.ts",
  "src/lib/actions/ledger-statement/get-dealer-statement.ts",
  "src/lib/actions/ledger-statement/get-dealer-statement-summary.ts",
  "src/lib/actions/dealer-ownership/get-dealer-ownership-history.ts",
  "src/lib/actions/dealer-ownership/get-current-dealer-ownership.ts",
] as const;

export const TERRITORY_CERTIFICATION_CHECK_CATALOG: TerritoryCertificationCheckDefinition[] =
  [
    {
      id: "RULE_01_SR_ISOLATION",
      name: "SR scoped to assigned territories on list and due report actions",
      subsystem: "territorySecurity",
      category: "territory_rbac",
      severity: "critical",
      ruleNumber: 1,
    },
    {
      id: "RULE_02_MANAGER_ISOLATION",
      name: "Manager scoped to assigned territories only",
      subsystem: "territorySecurity",
      category: "territory_rbac",
      severity: "critical",
      ruleNumber: 2,
    },
    {
      id: "RULE_03_SUPER_ADMIN_GLOBAL",
      name: "Super_Admin and Accounts have global territory visibility",
      subsystem: "territorySecurity",
      category: "territory_rbac",
      severity: "critical",
      ruleNumber: 3,
    },
    {
      id: "RULE_04_OWNERSHIP_TRANSFER_HISTORY",
      name: "Dealer transfer closes prior ownership without rewriting invoices",
      subsystem: "ownershipIntegrity",
      category: "ownership_history",
      severity: "critical",
      ruleNumber: 4,
    },
    {
      id: "RULE_05_DUE_USES_CACHE",
      name: "Due report uses Dealer.currentBalance as authoritative source",
      subsystem: "dueAccuracy",
      category: "due_reporting",
      severity: "critical",
      ruleNumber: 5,
    },
    {
      id: "RULE_06_AGING_BUCKETS",
      name: "Invoice aging buckets classify 0–30, 31–60, 61–90, 90+ correctly",
      subsystem: "dueAccuracy",
      category: "aging_accuracy",
      severity: "critical",
      ruleNumber: 6,
    },
    {
      id: "RULE_07_AGING_VS_BALANCE",
      name: "SUM(invoice aging) vs Dealer.currentBalance delta documented",
      subsystem: "dueAccuracy",
      category: "aging_accuracy",
      severity: "critical",
      ruleNumber: 7,
    },
    {
      id: "RULE_08_REPOSITORY_BOUNDARY",
      name: "No duplicated due logic or rogue territory checks in actions",
      subsystem: "financialBoundary",
      category: "repository_boundary",
      severity: "critical",
      ruleNumber: 8,
    },
    {
      id: "DETAIL_ACTION_TERRITORY_GATES",
      name: "Detail actions gate via canAccess* from territory engine",
      subsystem: "territorySecurity",
      category: "territory_rbac",
      severity: "critical",
    },
    {
      id: "COLLECTION_CONTEXT_TERRITORY_GATE",
      name: "Collection workspace context enforces territory access",
      subsystem: "territorySecurity",
      category: "territory_rbac",
      severity: "warning",
    },
    {
      id: "OWNERSHIP_HISTORICAL_ATTRIBUTION",
      name: "Ownership resolved at invoice issue date for aging attribution",
      subsystem: "ownershipIntegrity",
      category: "historical_attribution",
      severity: "critical",
    },
    {
      id: "DUE_REPORT_MODULE_BOUNDARY",
      name: "Due report module does not import posting-service",
      subsystem: "financialBoundary",
      category: "financial_boundary",
      severity: "critical",
    },
    {
      id: "GEOGRAPHY_FOUNDATION_PRESENT",
      name: "Geography hierarchy models and actions exist (PHASE_08A)",
      subsystem: "territorySecurity",
      category: "territory_rbac",
      severity: "critical",
    },
    {
      id: "LARGE_DATASET_PAGINATION",
      name: "Due report enforces server-side pagination limits",
      subsystem: "dueAccuracy",
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
  definition: TerritoryCertificationCheckDefinition,
  passed: boolean,
  message: string,
  options: { warning?: boolean; durationMs?: number } = {},
): TerritoryCertificationCheckResult {
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

function passResult(
  definition: TerritoryCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): TerritoryCertificationCheckResult {
  return makeResult(definition, true, message, { durationMs });
}

function failResult(
  definition: TerritoryCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): TerritoryCertificationCheckResult {
  return makeResult(definition, false, message, { durationMs });
}

function warnResult(
  definition: TerritoryCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): TerritoryCertificationCheckResult {
  return makeResult(definition, true, message, { warning: true, durationMs });
}

function getDefinition(id: string): TerritoryCertificationCheckDefinition {
  const definition = TERRITORY_CERTIFICATION_CHECK_CATALOG.find(
    (check) => check.id === id,
  );
  if (!definition) {
    throw new Error(`Unknown certification check: ${id}`);
  }
  return definition;
}

export async function resolveDatabaseAvailability(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 500),
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

/** Scan for duplicated due balance logic outside the due report module. */
export function scanDuplicatedDueLogic(): SourceFileHit[] {
  const hits: SourceFileHit[] = [];
  const pattern =
    /currentBalance\s*=\s*.*grandTotal|grandTotal\.sub\(.*\)\.plus\(|recompute.*balance/i;

  for (const file of collectSourceFiles(SRC_ROOT)) {
    const relative = relativePath(file);
    if (relative.startsWith("src/lib/reports/due/")) continue;
    if (relative.includes("posting-service")) continue;
    if (relative.includes("certification/")) continue;

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

/** Scan for direct territoryId comparisons in server actions outside RBAC module. */
export function scanRogueTerritoryChecks(): SourceFileHit[] {
  const hits: SourceFileHit[] = [];
  const allowedFiles = new Set([
    "src/lib/actions/dealers/update-dealer.ts",
  ]);
  const allowedPrefixes = [
    "src/lib/rbac/territory/",
    "src/lib/dealers/ownership/",
    "src/lib/actions/territory-assignments/",
    "src/lib/certification/",
    "src/lib/reports/due/",
  ];

  for (const file of collectSourceFiles(path.join(SRC_ROOT, "lib/actions"))) {
    const relative = relativePath(file);
    if (allowedFiles.has(relative)) continue;
    if (allowedPrefixes.some((prefix) => relative.startsWith(prefix))) continue;

    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/territoryId\s*(!==|===|!=|==)/.test(lines[i])) {
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

/** Scan due report UI for forbidden client-side balance calculations. */
export function scanClientSideDueCalculations(): SourceFileHit[] {
  const hits: SourceFileHit[] = [];
  const reportUi = path.join(SRC_ROOT, "app/(dashboard)/reports/due/page-client.tsx");
  if (!fileExists(relativePath(reportUi))) {
    return hits;
  }

  const content = readFileSync(reportUi, "utf8");
  const forbidden = [
    /currentBalance\s*[+\-*/]/,
    /grandTotal\s*[+\-*/]/,
    /computeInvoiceOutstanding/,
    /\.plus\(/,
    /\.minus\(/,
  ];

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (forbidden.some((pattern) => pattern.test(lines[i]))) {
      hits.push({
        file: relativePath(reportUi),
        line: i + 1,
        content: lines[i].trim(),
      });
    }
  }
  return hits;
}

export interface AgingBalanceInput {
  dealerCode: string;
  currentBalance: Prisma.Decimal;
  hasOpeningBalance: boolean;
  hasUnallocatedCollections: boolean;
  invoices: Array<{
    dueDate: Date;
    grandTotal: Prisma.Decimal;
    collectionReceived: Prisma.Decimal;
    status: InvoiceStatus;
  }>;
}

/**
 * Rule 7 — Compare SUM(invoice aging) vs Dealer.currentBalance and explain delta.
 */
export function reconcileAgingAgainstBalance(
  input: AgingBalanceInput,
  asOfDate: Date,
): AgingBalanceReconciliation {
  const aging = accumulateInvoiceAging(input.invoices, asOfDate);
  const totalAging = totalAgingAmount(aging);
  const delta = input.currentBalance.minus(totalAging);

  const explainedBy: Array<AgingBalanceReconciliation["explainedBy"][number]> = [];

  if (delta.equals(ZERO)) {
    return {
      dealerCode: input.dealerCode,
      dealerBalance: input.currentBalance.toFixed(2),
      totalInvoiceAging: totalAging.toFixed(2),
      delta: delta.toFixed(2),
      explainedBy,
    };
  }

  if (input.currentBalance.lessThan(ZERO)) {
    explainedBy.push("advance_payment");
  }
  if (input.hasOpeningBalance) {
    explainedBy.push("opening_balance");
  }
  if (input.hasUnallocatedCollections) {
    explainedBy.push("unallocated_collections");
  }
  if (explainedBy.length === 0) {
    explainedBy.push("unexplained");
  }

  return {
    dealerCode: input.dealerCode,
    dealerBalance: input.currentBalance.toFixed(2),
    totalInvoiceAging: totalAging.toFixed(2),
    delta: delta.toFixed(2),
    explainedBy,
  };
}

function verifyScopedListActions(): TerritoryCertificationCheckResult {
  const definition = getDefinition("RULE_01_SR_ISOLATION");
  const missing: string[] = [];

  for (const actionFile of TERRITORY_SCOPED_ACTIONS) {
    if (!fileExists(actionFile)) {
      missing.push(`${actionFile} (missing)`);
      continue;
    }
    const content = readSourceFile(actionFile);
    if (!content.includes("buildTerritoryScope")) {
      missing.push(actionFile);
    }
  }

  if (missing.length > 0) {
    return failResult(
      definition,
      `List/due actions missing buildTerritoryScope: ${missing.join(", ")}`,
    );
  }

  const srScope = buildScopedTerritoryScope(["terr-a"]);
  const merged = mergeDealerTerritoryScope({ isActive: true }, srScope);
  if (!JSON.stringify(merged).includes("terr-a")) {
    return failResult(definition, "mergeDealerTerritoryScope failed SR isolation test");
  }

  return passResult(
    definition,
    `${TERRITORY_SCOPED_ACTIONS.length} scoped list/due actions verified`,
  );
}

function verifyManagerIsolation(): TerritoryCertificationCheckResult {
  const definition = getDefinition("RULE_02_MANAGER_ISOLATION");

  if (!isScopedTerritoryRole("Manager")) {
    return failResult(definition, "Manager is not a scoped territory role");
  }

  const scope = buildScopedTerritoryScope(["mgr-terr-1", "mgr-terr-2"]);
  const orderScope = mergeOrderTerritoryScope({}, scope);
  const collectionScope = mergeCollectionTerritoryScope({}, scope);

  const orderOk = JSON.stringify(orderScope).includes("mgr-terr-1");
  const collectionOk = JSON.stringify(collectionScope).includes("mgr-terr-1");

  if (!orderOk || !collectionOk) {
    return failResult(definition, "Manager territory filters not applied to orders/collections");
  }

  return passResult(definition, "Manager uses same TERRITORIES scope as SR");
}

function verifySuperAdminGlobal(): TerritoryCertificationCheckResult {
  const definition = getDefinition("RULE_03_SUPER_ADMIN_GLOBAL");

  if (resolveTerritoryScopeMode("Super_Admin") !== "ALL") {
    return failResult(definition, "Super_Admin does not resolve to ALL scope");
  }
  if (!isGlobalTerritoryRole("Accounts")) {
    return failResult(definition, "Accounts is not a global territory role");
  }
  if (!territoryIdMatchesScope({ mode: "ALL" }, "any-territory")) {
    return failResult(definition, "ALL scope does not permit any territory");
  }

  return passResult(definition, "Super_Admin and Accounts have ALL scope");
}

function verifyOwnershipTransferHistory(): TerritoryCertificationCheckResult {
  const definition = getDefinition("RULE_04_OWNERSHIP_TRANSFER_HISTORY");
  const serviceFile = "src/lib/dealers/ownership/ownership-service.ts";

  if (!fileExists(serviceFile)) {
    return failResult(definition, "ownership-service.ts not found");
  }

  const content = readSourceFile(serviceFile);
  const hasClose = content.includes("closeActiveOwnership");
  const hasEffectiveTo = content.includes("effectiveTo");
  const hasIsActiveFalse = content.includes("isActive: false");

  if (!hasClose || !hasEffectiveTo || !hasIsActiveFalse) {
    return failResult(
      definition,
      "Transfer does not close prior ownership record with effectiveTo",
    );
  }

  const invoiceMutations = collectSourceFiles(SRC_ROOT).filter((file) => {
    const relative = relativePath(file);
    return (
      relative.includes("ownership-service") &&
      /invoice\.(update|delete)/.test(readFileSync(file, "utf8"))
    );
  });

  if (invoiceMutations.length > 0) {
    return failResult(definition, "Ownership service mutates invoices on transfer");
  }

  return passResult(
    definition,
    "Transfer closes prior ownership; invoices not rewritten",
  );
}

function verifyDueUsesCache(): TerritoryCertificationCheckResult {
  const definition = getDefinition("RULE_05_DUE_USES_CACHE");
  const serviceFile = "src/lib/reports/due/due-report-service.ts";
  const queryFile = "src/lib/reports/due/due-report-query.ts";

  const serviceContent = readSourceFile(serviceFile);
  const queryContent = readSourceFile(queryFile);

  if (!serviceContent.includes("dealer.currentBalance")) {
    return failResult(definition, "due-report-service does not read dealer.currentBalance");
  }
  if (/grandTotal\.sub|computeInvoiceOutstanding/.test(serviceContent)) {
    return failResult(
      definition,
      "due-report-service recomputes balance from invoices",
    );
  }
  if (!queryContent.includes("currentBalance: true")) {
    return failResult(definition, "due-report-query does not select currentBalance");
  }

  return passResult(definition, "Due report reads Dealer.currentBalance verbatim");
}

function verifyAgingBuckets(): TerritoryCertificationCheckResult {
  const definition = getDefinition("RULE_06_AGING_BUCKETS");

  const cases: Array<{ days: number; expected: string }> = [
    { days: 0, expected: "current" },
    { days: 15, expected: "days30" },
    { days: 30, expected: "days30" },
    { days: 31, expected: "days60" },
    { days: 60, expected: "days60" },
    { days: 61, expected: "days90" },
    { days: 90, expected: "days90" },
    { days: 91, expected: "days90Plus" },
  ];

  for (const { days, expected } of cases) {
    if (classifyAgingBucket(days) !== expected) {
      return failResult(
        definition,
        `Day ${days} classified as ${classifyAgingBucket(days)}, expected ${expected}`,
      );
    }
  }

  const asOf = new Date("2026-07-11");
  const dueDate = new Date("2026-06-01");
  const overdueDays = computeDaysOverdue(dueDate, asOf);
  if (overdueDays !== 40 || classifyAgingBucket(overdueDays) !== "days60") {
    return failResult(definition, `40-day overdue invoice misclassified (${overdueDays} days)`);
  }

  return passResult(definition, "Aging buckets 0–30, 31–60, 61–90, 90+ verified");
}

function verifyAgingVsBalanceRule(): TerritoryCertificationCheckResult {
  const definition = getDefinition("RULE_07_AGING_VS_BALANCE");

  const advance = reconcileAgingAgainstBalance(
    {
      dealerCode: "ADV",
      currentBalance: new Prisma.Decimal("-500.00"),
      hasOpeningBalance: false,
      hasUnallocatedCollections: false,
      invoices: [],
    },
    new Date(),
  );
  if (!advance.explainedBy.includes("advance_payment")) {
    return failResult(definition, "Advance balance delta not explained");
  }

  const opening = reconcileAgingAgainstBalance(
    {
      dealerCode: "OB",
      currentBalance: new Prisma.Decimal("2000.00"),
      hasOpeningBalance: true,
      hasUnallocatedCollections: false,
      invoices: [
        {
          dueDate: new Date("2026-06-01"),
          grandTotal: new Prisma.Decimal("1000.00"),
          collectionReceived: ZERO,
          status: InvoiceStatus.Issued,
        },
      ],
    },
    new Date("2026-07-11"),
  );
  if (!opening.explainedBy.includes("opening_balance")) {
    return failResult(definition, "Opening balance delta not explained");
  }

  const unallocated = reconcileAgingAgainstBalance(
    {
      dealerCode: "UNC",
      currentBalance: new Prisma.Decimal("3000.00"),
      hasOpeningBalance: false,
      hasUnallocatedCollections: true,
      invoices: [
        {
          dueDate: new Date("2026-06-01"),
          grandTotal: new Prisma.Decimal("1000.00"),
          collectionReceived: ZERO,
          status: InvoiceStatus.Issued,
        },
      ],
    },
    new Date("2026-07-11"),
  );
  if (!unallocated.explainedBy.includes("unallocated_collections")) {
    return failResult(definition, "Unallocated collection delta not explained");
  }

  return passResult(
    definition,
    "Aging vs balance deltas documented for opening balance, unallocated collections, advance",
  );
}

function verifyRepositoryBoundary(): TerritoryCertificationCheckResult {
  const definition = getDefinition("RULE_08_REPOSITORY_BOUNDARY");

  const duplicated = scanDuplicatedDueLogic();
  const rogueTerritory = scanRogueTerritoryChecks();
  const clientCalc = scanClientSideDueCalculations();

  const issues: string[] = [];
  if (duplicated.length > 0) {
    issues.push(`duplicated due logic: ${duplicated.map((h) => h.file).join(", ")}`);
  }
  if (rogueTerritory.length > 0) {
    issues.push(`rogue territory checks: ${rogueTerritory.map((h) => h.file).join(", ")}`);
  }
  if (clientCalc.length > 0) {
    issues.push(`client-side due calculations: ${clientCalc.map((h) => h.file).join(", ")}`);
  }

  if (issues.length > 0) {
    return failResult(definition, issues.join("; "));
  }

  return passResult(definition, "No duplicated due logic or rogue territory checks found");
}

function verifyDetailActionGates(): TerritoryCertificationCheckResult {
  const definition = getDefinition("DETAIL_ACTION_TERRITORY_GATES");
  const missing: string[] = [];

  for (const actionFile of TERRITORY_GATED_DETAIL_ACTIONS) {
    if (!fileExists(actionFile)) {
      missing.push(`${actionFile} (missing)`);
      continue;
    }
    const content = readSourceFile(actionFile);
    if (!/canAccess(Dealer|Order|Collection|DealerByCode|Statement)/.test(content)) {
      missing.push(actionFile);
    }
  }

  if (missing.length > 0) {
    return failResult(
      definition,
      `Detail actions missing canAccess* gate: ${missing.join(", ")}`,
    );
  }

  return passResult(
    definition,
    `${TERRITORY_GATED_DETAIL_ACTIONS.length} detail actions use canAccess* gates`,
  );
}

function verifyCollectionContextGate(): TerritoryCertificationCheckResult {
  const definition = getDefinition("COLLECTION_CONTEXT_TERRITORY_GATE");
  const file = "src/lib/actions/collections/get-dealer-collection-context.ts";

  if (!fileExists(file)) {
    return failResult(definition, "get-dealer-collection-context.ts not found");
  }

  const content = readSourceFile(file);
  if (content.includes("canAccessDealerByCode") || content.includes("canAccessDealer")) {
    return passResult(definition, "Collection context enforces territory access");
  }

  return failResult(
    definition,
    "getDealerCollectionContext lacks territory RBAC gate",
  );
}

function verifyHistoricalAttribution(): TerritoryCertificationCheckResult {
  const definition = getDefinition("OWNERSHIP_HISTORICAL_ATTRIBUTION");

  const histories = [
    {
      dealerId: "d1",
      assignedSrId: "sr-old",
      assignedSrName: "Old SR",
      effectiveFrom: new Date("2026-01-01"),
      effectiveTo: new Date("2026-05-15"),
    },
    {
      dealerId: "d1",
      assignedSrId: "sr-new",
      assignedSrName: "New SR",
      effectiveFrom: new Date("2026-05-15"),
      effectiveTo: null,
    },
  ];

  const beforeTransfer = resolveOwnershipAtDate(
    histories,
    "d1",
    new Date("2026-04-01"),
  );
  const afterTransfer = resolveOwnershipAtDate(
    histories,
    "d1",
    new Date("2026-06-01"),
  );

  if (beforeTransfer?.assignedSrId !== "sr-old" || afterTransfer?.assignedSrId !== "sr-new") {
    return failResult(definition, "Ownership snapshot at date failed");
  }

  const agingFile = readSourceFile("src/lib/reports/due/due-report-service.ts");
  if (!agingFile.includes("resolveOwnershipAtDate")) {
    return failResult(definition, "Due aging report does not use ownership-at-date resolution");
  }

  return passResult(
    definition,
    "Historical SR attribution uses ownership effective at invoice issueDate",
  );
}

function verifyDueReportFinancialBoundary(): TerritoryCertificationCheckResult {
  const definition = getDefinition("DUE_REPORT_MODULE_BOUNDARY");
  const dueFiles = collectSourceFiles(path.join(SRC_ROOT, "lib/reports/due"));
  const violations: string[] = [];

  for (const file of dueFiles) {
    const content = readFileSync(file, "utf8");
    if (
      content.includes("posting-service") ||
      content.includes("createLedgerEntry") ||
      /dealer\.update\(/.test(content)
    ) {
      violations.push(relativePath(file));
    }
  }

  if (violations.length > 0) {
    return failResult(
      definition,
      `Due report module imports forbidden writers: ${violations.join(", ")}`,
    );
  }

  return passResult(definition, "Due report module is read-only — no posting imports");
}

function verifyGeographyFoundation(): TerritoryCertificationCheckResult {
  const definition = getDefinition("GEOGRAPHY_FOUNDATION_PRESENT");
  const required = [
    "src/lib/actions/geography/list-divisions.ts",
    "src/lib/actions/geography/list-districts-by-division.ts",
    "src/lib/actions/geography/list-territories-by-district.ts",
    "src/components/geography/division-select.tsx",
    "prisma/seeds/bangladesh-geography.ts",
  ];

  const missing = required.filter((file) => !fileExists(file));
  if (missing.length > 0) {
    return failResult(definition, `Missing geography files: ${missing.join(", ")}`);
  }

  return passResult(definition, "Geography foundation (PHASE_08A) artifacts present");
}

function verifyPaginationLimits(): TerritoryCertificationCheckResult {
  const definition = getDefinition("LARGE_DATASET_PAGINATION");
  const validationFile = readSourceFile("src/lib/reports/due/due-report-validation.ts");

  if (!validationFile.includes("pageSize > 500")) {
    return warnResult(definition, "Page size cap of 500 not found in validation");
  }

  return passResult(definition, "Due report enforces max page size 500 server-side");
}

/** Run behavioral SR isolation test with in-memory stub. */
export async function verifySrIsolationBehavior(
  client: DueReportReadClient,
): Promise<boolean> {
  const scope: TerritoryScope = { mode: "TERRITORIES", territoryIds: ["terr-1"] };
  const result = await getDueReport(
    { page: 1, pageSize: 50, includeZeroBalance: true, includeAdvance: true },
    scope,
    client,
  );
  return result.rows.every(
    (row) => row.territoryName === "Zone A" || row.territoryName === null,
  );
}

export function aggregateSubsystemStatuses(
  checks: TerritoryCertificationCheckResult[],
): Record<TerritoryCertificationSubsystem, TerritoryCertificationStatus> {
  const subsystems: TerritoryCertificationSubsystem[] = [
    "territorySecurity",
    "ownershipIntegrity",
    "dueAccuracy",
    "financialBoundary",
  ];

  const result = {} as Record<TerritoryCertificationSubsystem, TerritoryCertificationStatus>;

  for (const subsystem of subsystems) {
    const subsystemChecks = checks.filter((check) => check.subsystem === subsystem);
    const passedChecks = subsystemChecks.filter(
      (check) => check.passed && !check.warning,
    ).length;
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

export function computeOverallScore(checks: TerritoryCertificationCheckResult[]): {
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
    criticalFailures === 0 &&
    overallScore >= TERRITORY_PRODUCTION_READINESS_THRESHOLD;

  return {
    overallScore,
    passedChecks,
    failedChecks,
    warnings,
    productionReady,
  };
}

export async function runAllTerritoryCertificationChecks(
  // Context reserved for future live-database checks (PHASE_08E is structural only).
): Promise<{
  checks: TerritoryCertificationCheckResult[];
  agingReconciliations: AgingBalanceReconciliation[];
}> {
  const checks: TerritoryCertificationCheckResult[] = [
    verifyScopedListActions(),
    verifyManagerIsolation(),
    verifySuperAdminGlobal(),
    verifyOwnershipTransferHistory(),
    verifyDueUsesCache(),
    verifyAgingBuckets(),
    verifyAgingVsBalanceRule(),
    verifyRepositoryBoundary(),
    verifyDetailActionGates(),
    verifyCollectionContextGate(),
    verifyHistoricalAttribution(),
    verifyDueReportFinancialBoundary(),
    verifyGeographyFoundation(),
    verifyPaginationLimits(),
  ];

  const agingReconciliations: AgingBalanceReconciliation[] = [
    reconcileAgingAgainstBalance(
      {
        dealerCode: "DUE-001",
        currentBalance: new Prisma.Decimal("5000.00"),
        hasOpeningBalance: false,
        hasUnallocatedCollections: true,
        invoices: [
          {
            dueDate: new Date("2026-06-01"),
            grandTotal: new Prisma.Decimal("3000.00"),
            collectionReceived: ZERO,
            status: InvoiceStatus.Issued,
          },
        ],
      },
      new Date("2026-07-11"),
    ),
    reconcileAgingAgainstBalance(
      {
        dealerCode: "ADV-001",
        currentBalance: new Prisma.Decimal("-1500.00"),
        hasOpeningBalance: false,
        hasUnallocatedCollections: false,
        invoices: [],
      },
      new Date("2026-07-11"),
    ),
    reconcileAgingAgainstBalance(
      {
        dealerCode: "OB-001",
        currentBalance: new Prisma.Decimal("2500.00"),
        hasOpeningBalance: true,
        hasUnallocatedCollections: false,
        invoices: [
          {
            dueDate: new Date("2026-07-15"),
            grandTotal: new Prisma.Decimal("1000.00"),
            collectionReceived: ZERO,
            status: InvoiceStatus.Issued,
          },
        ],
      },
      new Date("2026-07-11"),
    ),
  ];

  return { checks, agingReconciliations };
}
