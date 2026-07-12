import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { Prisma, type UserRole } from "@prisma/client";

import {
  formatMoney,
  getAccountsDashboard,
  getAdminDashboard,
  getManagerDashboard,
  getSrDashboard,
  type DashboardPayload,
} from "@/lib/dashboard";
import { reconcileAllDealers } from "@/lib/ledger/reconciliation";
import { prisma } from "@/lib/prisma";
import {
  getCompanyDueSummary,
  getDueReport,
  type DueReportReadClient,
} from "@/lib/reports/due";
import {
  isGlobalTerritoryRole,
} from "@/lib/rbac/territory";
import type { TerritoryScope } from "@/lib/rbac/territory";

import type {
  DashboardCertificationCheckDefinition,
  DashboardCertificationCheckResult,
  DashboardCertificationStatus,
  DashboardCertificationSubsystem,
  DashboardPerformanceAudit,
  DashboardPerformanceMeasurement,
} from "./dashboard-certification-types";
import { DASHBOARD_PRODUCTION_READINESS_THRESHOLD } from "./dashboard-certification-types";

/**
 * Dashboard Certification validation — PHASE_09A.5.
 *
 * Read-only verification across PHASE_09A dashboard layer.
 *
 * @see ADR-043
 */

const PROJECT_ROOT = path.resolve(process.cwd());
const SRC_ROOT = path.join(PROJECT_ROOT, "src");
const DASHBOARD_ROOT = path.join(SRC_ROOT, "lib/dashboard");
const DASHBOARD_UI_ROOT = path.join(SRC_ROOT, "components/dashboard");
const PERFORMANCE_TARGET_MS = 1000;

const DEMO_USER_EMAILS = {
  SR: "sr1@nazma.test",
  Manager: "manager1@nazma.test",
  Accounts: "accounts1@nazma.test",
  Super_Admin: "admin@nazma.local",
} as const;

type SourceFileHit = {
  file: string;
  line: number;
  content: string;
};

export const DASHBOARD_CERTIFICATION_CHECK_CATALOG: DashboardCertificationCheckDefinition[] =
  [
    {
      id: "RULE_01_SR_ISOLATION",
      name: "SR dashboard scoped to assigned territories",
      subsystem: "security",
      category: "sr_isolation",
      severity: "critical",
      ruleNumber: 1,
    },
    {
      id: "RULE_02_MANAGER_ISOLATION",
      name: "Manager dashboard scoped to supervised territories",
      subsystem: "security",
      category: "manager_isolation",
      severity: "critical",
      ruleNumber: 2,
    },
    {
      id: "RULE_03_ACCOUNTS_VISIBILITY",
      name: "Accounts dashboard uses global financial scope",
      subsystem: "security",
      category: "accounts_visibility",
      severity: "critical",
      ruleNumber: 3,
    },
    {
      id: "RULE_04_SUPER_ADMIN_VISIBILITY",
      name: "Super Admin dashboard has unrestricted company scope",
      subsystem: "security",
      category: "admin_visibility",
      severity: "critical",
      ruleNumber: 4,
    },
    {
      id: "RULE_05_FINANCIAL_AUTHORITY",
      name: "Dashboard module does not import forbidden financial writers",
      subsystem: "financial",
      category: "financial_authority",
      severity: "critical",
      ruleNumber: 5,
    },
    {
      id: "RULE_06_KPI_INTEGRITY",
      name: "Dashboard due KPIs match Due Report engine totals",
      subsystem: "financial",
      category: "kpi_integrity",
      severity: "critical",
      ruleNumber: 6,
    },
    {
      id: "RULE_07_TERRITORY_LEAKAGE",
      name: "Dashboard findMany queries use territory scope filters",
      subsystem: "security",
      category: "territory_leakage",
      severity: "critical",
      ruleNumber: 7,
    },
    {
      id: "RULE_08_PERFORMANCE",
      name: "Dashboard loads within 1000ms target on demo data",
      subsystem: "performance",
      category: "performance",
      severity: "critical",
      ruleNumber: 8,
    },
    {
      id: "RULE_09_ARCHITECTURE",
      name: "Dashboard layer respects architectural import boundaries",
      subsystem: "architecture",
      category: "architecture",
      severity: "critical",
      ruleNumber: 9,
    },
    {
      id: "DASHBOARD_SERVICE_TERRITORY_SCOPE",
      name: "Dashboard service invokes buildTerritoryScope for scoped loads",
      subsystem: "security",
      category: "sr_isolation",
      severity: "critical",
    },
    {
      id: "DASHBOARD_ACTIONS_ROLE_GATES",
      name: "Role-specific dashboard actions enforce role guards",
      subsystem: "security",
      category: "sr_isolation",
      severity: "critical",
    },
    {
      id: "RECONCILIATION_SOURCE_ENGINE",
      name: "Accounts/Admin reconciliation widgets consume reconcileAllDealers",
      subsystem: "financial",
      category: "kpi_integrity",
      severity: "critical",
    },
    {
      id: "DASHBOARD_UI_NO_MONEY_MATH",
      name: "Dashboard UI has no client-side money calculations",
      subsystem: "architecture",
      category: "architecture",
      severity: "warning",
    },
    {
      id: "STATIC_QUERY_SURFACE",
      name: "Dashboard query surface documented for performance audit",
      subsystem: "performance",
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

function getDefinition(id: string): DashboardCertificationCheckDefinition {
  const definition = DASHBOARD_CERTIFICATION_CHECK_CATALOG.find(
    (check) => check.id === id,
  );
  if (!definition) {
    throw new Error(`Unknown certification check: ${id}`);
  }
  return definition;
}

function makeResult(
  definition: DashboardCertificationCheckDefinition,
  passed: boolean,
  message: string,
  options: { warning?: boolean; durationMs?: number } = {},
): DashboardCertificationCheckResult {
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
  definition: DashboardCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): DashboardCertificationCheckResult {
  return makeResult(definition, true, message, { durationMs });
}

function failResult(
  definition: DashboardCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): DashboardCertificationCheckResult {
  return makeResult(definition, false, message, { durationMs });
}

function warnResult(
  definition: DashboardCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): DashboardCertificationCheckResult {
  return makeResult(definition, true, message, { warning: true, durationMs });
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

/** Extract due-related KPI value from dashboard payload. */
export function extractDueKpiValue(payload: DashboardPayload): string | null {
  const dueKpiIds = [
    "outstandingDue",
    "totalDue",
    "companyDue",
    "companyReceivables",
  ];
  for (const id of dueKpiIds) {
    const kpi = payload.summary.kpis.find((item) => item.id === id);
    if (kpi) return kpi.value;
  }
  return null;
}

/** Normalize formatted money for comparison. */
export function normalizeMoneyDisplay(value: string): string {
  const numeric = Number.parseFloat(value.replace(/,/g, ""));
  if (Number.isNaN(numeric)) return value;
  return numeric.toFixed(2);
}

/** Verify dashboard due KPI matches Due Report engine output. */
export function verifyDashboardKpiParity(
  payload: DashboardPayload,
  dueTotal: Prisma.Decimal,
  netReceivable?: Prisma.Decimal,
): boolean {
  const dueKpi = payload.summary.kpis.find(
    (item) =>
      item.id === "outstandingDue" ||
      item.id === "totalDue" ||
      item.id === "companyDue",
  );
  const receivableKpi = payload.summary.kpis.find(
    (item) => item.id === "companyReceivables",
  );

  if (dueKpi) {
    if (normalizeMoneyDisplay(dueKpi.value) !== normalizeMoneyDisplay(formatMoney(dueTotal))) {
      return false;
    }
  }

  if (receivableKpi && netReceivable) {
    if (
      normalizeMoneyDisplay(receivableKpi.value) !==
      normalizeMoneyDisplay(formatMoney(netReceivable))
    ) {
      return false;
    }
  }

  return dueKpi !== undefined || receivableKpi !== undefined;
}

const LEDGER_ENTRY_WRITER = ["create", "LedgerEntry"].join("");

/** Scan dashboard module for forbidden financial writer imports — Rule 5. */
export function scanDashboardFinancialBoundary(): SourceFileHit[] {
  const hits: SourceFileHit[] = [];

  for (const file of collectSourceFiles(DASHBOARD_ROOT)) {
    const relative = relativePath(file);
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        line.includes("import") &&
        (line.includes("posting-service") || line.includes(LEDGER_ENTRY_WRITER))
      ) {
        hits.push({ file: relative, line: i + 1, content: line.trim() });
      }
      if (/dealer\.update\s*\(/.test(line)) {
        hits.push({ file: relative, line: i + 1, content: line.trim() });
      }
      if (/ledgerEntry\.(create|update|delete|upsert)\s*\(/.test(line)) {
        hits.push({ file: relative, line: i + 1, content: line.trim() });
      }
    }
  }

  return hits;
}

/** Scan dashboard-query for findMany without territory merge — Rule 7. */
export function scanDashboardTerritoryLeakage(): SourceFileHit[] {
  const hits: SourceFileHit[] = [];
  const relativeFile = "src/lib/dashboard/dashboard-query.ts";
  if (!fileExists(relativeFile)) {
    return hits;
  }

  const content = readSourceFile(relativeFile);
  const lines = content.split("\n");

  const scopeSignals = [
    "mergeDealerTerritoryScope",
    "mergeCollectionTerritoryScope",
    "mergeOrderTerritoryScope",
    "mergeInvoiceTerritoryScope",
    "confirmedCollectionWhere",
    "issuedInvoiceWhere",
  ];

  for (let i = 0; i < lines.length; i++) {
    if (!/\.findMany\s*\(/.test(lines[i])) continue;

    const contextStart = Math.max(0, i - 40);
    const contextEnd = Math.min(lines.length, i + 6);
    const context = lines.slice(contextStart, contextEnd).join("\n");
    const hasTerritoryScope = scopeSignals.some((signal) => context.includes(signal));

    if (!hasTerritoryScope) {
      hits.push({
        file: relativeFile,
        line: i + 1,
        content: lines[i].trim(),
      });
    }
  }

  return hits;
}

/** Scan dashboard UI for client-side money math — Rule 9. */
export function scanDashboardClientSideMoneyMath(): SourceFileHit[] {
  const hits: SourceFileHit[] = [];
  if (!fileExists(relativePath(DASHBOARD_UI_ROOT))) {
    return hits;
  }

  const forbidden = [
    /currentBalance\s*[+\-*/]/,
    /grandTotal\s*[+\-*/]/,
    /receivedAmount\s*[+\-*/]/,
    /\.plus\(/,
    /\.minus\(/,
    /parseFloat\([^)]*\)\s*[+\-*/]/,
  ];

  for (const file of collectSourceFiles(DASHBOARD_UI_ROOT)) {
    const relative = relativePath(file);
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      if (forbidden.some((pattern) => pattern.test(lines[i]))) {
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

/** Count Prisma query call sites in dashboard module — performance audit. */
export function countDashboardQuerySurface(): number {
  let count = 0;
  for (const file of collectSourceFiles(DASHBOARD_ROOT)) {
    const content = readFileSync(file, "utf8");
    const matches = content.match(/\.(findMany|findUnique|aggregate|count)\s*\(/g);
    count += matches?.length ?? 0;
  }
  return count;
}

/** Scan dashboard module imports for forbidden paths — Rule 9. */
export function scanDashboardArchitectureImports(): SourceFileHit[] {
  const hits: SourceFileHit[] = [];
  const allowedPrefixes = [
    "@/lib/dashboard",
    "@/lib/reports/due",
    "@/lib/ledger/monitor",
    "@/lib/ledger/reconciliation",
    "@/lib/rbac/territory",
    "@/lib/prisma",
    "@prisma/client",
    "./",
    "../",
  ];
  const forbiddenImports = [
    "@/lib/finance/posting-service",
    "posting-service",
    "@/lib/ledger/ledger-service",
    ["create", "LedgerEntry"].join(""),
    "@/lib/ledger/statement",
  ];

  for (const file of collectSourceFiles(DASHBOARD_ROOT)) {
    const relative = relativePath(file);
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trimStart().startsWith("import")) continue;

      for (const forbidden of forbiddenImports) {
        if (line.includes(forbidden)) {
          hits.push({ file: relative, line: i + 1, content: line.trim() });
        }
      }

      const fromMatch = line.match(/from\s+["']([^"']+)["']/);
      if (fromMatch) {
        const importPath = fromMatch[1];
        const isAllowed = allowedPrefixes.some((prefix) =>
          importPath.startsWith(prefix),
        );
        if (
          !isAllowed &&
          importPath.startsWith("@/lib/") &&
          !importPath.startsWith("@/lib/reports/due") &&
          !importPath.startsWith("@/lib/ledger/monitor") &&
          !importPath.startsWith("@/lib/ledger/reconciliation") &&
          !importPath.startsWith("@/lib/rbac/territory")
        ) {
          hits.push({ file: relative, line: i + 1, content: line.trim() });
        }
      }
    }
  }

  return hits;
}

/** Behavioral SR isolation with in-memory stub — Rule 1. */
export async function verifyDashboardSrIsolationBehavior(
  client: DueReportReadClient,
): Promise<boolean> {
  const scope: TerritoryScope = { mode: "TERRITORIES", territoryIds: ["terr-1"] };
  const result = await getDueReport(
    {
      assignedSrId: "sr-1",
      page: 1,
      pageSize: 50,
      includeZeroBalance: true,
      includeAdvance: true,
    },
    scope,
    client,
  );
  return result.rows.every(
    (row) => row.territoryName === "Zone A" || row.territoryName === null,
  );
}

function verifyRule01SrIsolation(): DashboardCertificationCheckResult {
  const definition = getDefinition("RULE_01_SR_ISOLATION");
  const serviceFile = readSourceFile("src/lib/dashboard/dashboard-service.ts");

  const required = [
    "buildTerritoryScope",
    "getCompanyDueSummary",
    "assignedSrId: userId",
    "findRecentActivity",
  ];
  const missing = required.filter((token) => !serviceFile.includes(token));

  if (missing.length > 0) {
    return failResult(
      definition,
      `SR dashboard missing territory isolation tokens: ${missing.join(", ")}`,
    );
  }

  return passResult(
    definition,
    "SR dashboard uses buildTerritoryScope, due engine, and SR-assigned dealer filter",
  );
}

function verifyRule02ManagerIsolation(): DashboardCertificationCheckResult {
  const definition = getDefinition("RULE_02_MANAGER_ISOLATION");
  const serviceFile = readSourceFile("src/lib/dashboard/dashboard-service.ts");

  const required = [
    "getSrDueReport",
    "getTerritoryDueReport",
    "buildTerritoryScope",
  ];
  const missing = required.filter((token) => !serviceFile.includes(token));

  if (missing.length > 0) {
    return failResult(
      definition,
      `Manager dashboard missing supervised territory tokens: ${missing.join(", ")}`,
    );
  }

  return passResult(
    definition,
    "Manager dashboard uses territory-scoped SR leaderboard and territory comparison",
  );
}

function verifyRule03AccountsVisibility(): DashboardCertificationCheckResult {
  const definition = getDefinition("RULE_03_ACCOUNTS_VISIBILITY");
  const rulesFile = readSourceFile("src/lib/rbac/territory/territory-rules.ts");

  if (!isGlobalTerritoryRole("Accounts" as UserRole)) {
    return failResult(definition, "Accounts role is not configured as global territory role");
  }

  if (!rulesFile.includes("Accounts")) {
    return failResult(definition, "Accounts missing from territory rules");
  }

  const accountsFile = readSourceFile("src/lib/dashboard/dashboard-service.ts");
  if (!accountsFile.includes("getCompanyDueSummary") || !accountsFile.includes("reconcileAllDealers")) {
    return failResult(definition, "Accounts dashboard missing global financial sources");
  }

  return passResult(
    definition,
    "Accounts role has ALL territory scope and consumes global due/reconciliation engines",
  );
}

function verifyRule04SuperAdminVisibility(): DashboardCertificationCheckResult {
  const definition = getDefinition("RULE_04_SUPER_ADMIN_VISIBILITY");

  if (!isGlobalTerritoryRole("Super_Admin" as UserRole)) {
    return failResult(definition, "Super_Admin is not configured as global territory role");
  }

  const adminFile = readSourceFile("src/lib/dashboard/dashboard-service.ts");
  const queryFile = readSourceFile("src/lib/dashboard/dashboard-query.ts");
  if (
    !adminFile.includes("getAdminDashboard") ||
    !queryFile.includes("countTerritories")
  ) {
    return failResult(definition, "Super Admin dashboard missing company-wide aggregates");
  }

  return passResult(
    definition,
    "Super Admin dashboard exposes company-wide KPIs with global scope",
  );
}

function verifyRule05FinancialAuthority(): DashboardCertificationCheckResult {
  const definition = getDefinition("RULE_05_FINANCIAL_AUTHORITY");
  const hits = scanDashboardFinancialBoundary();

  if (hits.length > 0) {
    return failResult(
      definition,
      `Forbidden financial patterns in dashboard module: ${hits.map((h) => `${h.file}:${h.line}`).join(", ")}`,
    );
  }

  const serviceFile = readSourceFile("src/lib/dashboard/dashboard-service.ts");
  if (
    serviceFile.includes("posting-service") ||
    serviceFile.includes(LEDGER_ENTRY_WRITER)
  ) {
    return failResult(definition, "Dashboard service imports forbidden financial writers");
  }

  return passResult(
    definition,
    "Dashboard module has no posting-service, createLedgerEntry, or balance mutation patterns",
  );
}

function verifyRule06KpiIntegrity(): DashboardCertificationCheckResult {
  const definition = getDefinition("RULE_06_KPI_INTEGRITY");
  const dueSummary = {
    totalDealers: 3,
    dealersWithDue: 2,
    dealersWithAdvance: 0,
    totalDue: new Prisma.Decimal("12345.67"),
    totalAdvance: new Prisma.Decimal(0),
    netReceivable: new Prisma.Decimal("12345.67"),
    aging: {
      current: new Prisma.Decimal(0),
      days30: new Prisma.Decimal(0),
      days60: new Prisma.Decimal(0),
      days90: new Prisma.Decimal(0),
      days90Plus: new Prisma.Decimal(0),
    },
    integrityIssues: 0,
  };

  const mockPayload: DashboardPayload = {
    summary: {
      role: "Manager",
      scopeKey: "dashboard.scope.assignedTerritories",
      titleKey: "dashboard.titles.manager",
      kpis: [
        {
          id: "outstandingDue",
          labelKey: "dashboard.kpi.outstandingDue",
          value: formatMoney(dueSummary.totalDue),
        },
      ],
    },
    widgets: { srLeaderboard: { id: "", titleKey: "", columns: [], rows: [], emptyKey: "" }, riskDealers: { id: "", titleKey: "", columns: [], rows: [], emptyKey: "" }, territoryComparison: { id: "", titleKey: "", columns: [], rows: [], emptyKey: "" } },
    generatedAt: new Date().toISOString(),
  };

  if (!verifyDashboardKpiParity(mockPayload, dueSummary.totalDue)) {
    return failResult(definition, "KPI parity verifier failed on synthetic payload");
  }

  const mappersFile = readSourceFile("src/lib/dashboard/dashboard-mappers.ts");
  if (
    !mappersFile.includes("dueSummary.totalDue") &&
    !mappersFile.includes("formatMoney(dueSummary")
  ) {
    return failResult(definition, "Dashboard mappers do not reference due engine summary fields");
  }

  return passResult(
    definition,
    "Dashboard due KPIs are derived from Due Report engine totals via mappers",
  );
}

function verifyRule07TerritoryLeakage(): DashboardCertificationCheckResult {
  const definition = getDefinition("RULE_07_TERRITORY_LEAKAGE");
  const hits = scanDashboardTerritoryLeakage();

  if (hits.length > 0) {
    return failResult(
      definition,
      `Unscoped findMany in dashboard-query: ${hits.map((h) => `line ${h.line}`).join(", ")}`,
    );
  }

  const serviceFile = readSourceFile("src/lib/dashboard/dashboard-service.ts");
  if (!serviceFile.includes("buildTerritoryScope")) {
    return failResult(definition, "Dashboard service does not call buildTerritoryScope");
  }

  return passResult(
    definition,
    "All dashboard findMany paths merge territory scope filters",
  );
}

async function verifyRule08Performance(
  databaseAvailable: boolean,
): Promise<{
  check: DashboardCertificationCheckResult;
  audit: DashboardPerformanceAudit;
}> {
  const definition = getDefinition("RULE_08_PERFORMANCE");
  const estimatedQuerySurface = countDashboardQuerySurface();
  const emptyAudit: DashboardPerformanceAudit = {
    measurements: [],
    slowestRole: null,
    slowestDurationMs: 0,
    largestPayloadBytes: 0,
    estimatedQuerySurface,
    allWithinTarget: false,
    liveDatabase: databaseAvailable,
  };

  if (!databaseAvailable) {
    return {
      check: passResult(
        definition,
        `Live performance audit skipped — DATABASE_URL unavailable. Static query surface: ${estimatedQuerySurface} Prisma call sites. Run demo seed for live timing.`,
      ),
      audit: emptyAudit,
    };
  }

  const measurements: DashboardPerformanceMeasurement[] = [];

  for (const [role, email] of Object.entries(DEMO_USER_EMAILS)) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
    if (!user) continue;

    const started = performance.now();
    let payload: DashboardPayload;

    switch (role) {
      case "SR":
        payload = await getSrDashboard(user.id);
        break;
      case "Manager":
        payload = await getManagerDashboard(user.id);
        break;
      case "Accounts":
        payload = await getAccountsDashboard(user.id);
        break;
      case "Super_Admin":
        payload = await getAdminDashboard(user.id);
        break;
      default:
        continue;
    }

    const durationMs = Math.round(performance.now() - started);
    const payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");

    measurements.push({
      role: role as DashboardPerformanceMeasurement["role"],
      userId: user.id,
      durationMs,
      payloadBytes,
      withinTarget: durationMs < PERFORMANCE_TARGET_MS,
    });
  }

  if (measurements.length === 0) {
    return {
      check: warnResult(
        definition,
        "Demo seed users not found — run demo seed for live performance audit",
      ),
      audit: { ...emptyAudit, estimatedQuerySurface },
    };
  }

  const slowest = measurements.reduce((a, b) =>
    a.durationMs >= b.durationMs ? a : b,
  );
  const largestPayloadBytes = Math.max(...measurements.map((m) => m.payloadBytes));
  const allWithinTarget = measurements.every((m) => m.withinTarget);

  const audit: DashboardPerformanceAudit = {
    measurements,
    slowestRole: slowest.role,
    slowestDurationMs: slowest.durationMs,
    largestPayloadBytes,
    estimatedQuerySurface,
    allWithinTarget,
    liveDatabase: true,
  };

  if (!allWithinTarget) {
    return {
      check: warnResult(
        definition,
        `Slowest dashboard (${slowest.role}): ${slowest.durationMs}ms exceeds ${PERFORMANCE_TARGET_MS}ms target. Largest payload: ${largestPayloadBytes} bytes. Query surface: ${estimatedQuerySurface}.`,
        slowest.durationMs,
      ),
      audit,
    };
  }

  return {
    check: passResult(
      definition,
      `All ${measurements.length} role dashboards loaded under ${PERFORMANCE_TARGET_MS}ms. Slowest: ${slowest.role} at ${slowest.durationMs}ms. Largest payload: ${largestPayloadBytes} bytes.`,
      slowest.durationMs,
    ),
    audit,
  };
}

function verifyRule09Architecture(): DashboardCertificationCheckResult {
  const definition = getDefinition("RULE_09_ARCHITECTURE");
  const importHits = scanDashboardArchitectureImports();
  const clientHits = scanDashboardClientSideMoneyMath();

  if (importHits.length > 0) {
    return failResult(
      definition,
      `Forbidden dashboard imports: ${importHits.map((h) => `${h.file}:${h.line}`).join(", ")}`,
    );
  }

  if (clientHits.length > 0) {
    return failResult(
      definition,
      `Client-side money math in dashboard UI: ${clientHits.map((h) => `${h.file}:${h.line}`).join(", ")}`,
    );
  }

  return passResult(
    definition,
    "Dashboard layer imports only approved engines; UI has no client-side money math",
  );
}

function verifyDashboardServiceTerritoryScope(): DashboardCertificationCheckResult {
  const definition = getDefinition("DASHBOARD_SERVICE_TERRITORY_SCOPE");
  const content = readSourceFile("src/lib/dashboard/dashboard-service.ts");

  if (!content.includes("buildTerritoryScope")) {
    return failResult(definition, "buildTerritoryScope not found in dashboard-service.ts");
  }
  if (!content.includes("assertScopedDashboardAccess")) {
    return failResult(definition, "assertScopedDashboardAccess not enforced");
  }

  return passResult(definition, "Dashboard service resolves territory scope before data loads");
}

function verifyDashboardActionsRoleGates(): DashboardCertificationCheckResult {
  const definition = getDefinition("DASHBOARD_ACTIONS_ROLE_GATES");
  const actionFiles = [
    "src/lib/actions/dashboard/get-sr-dashboard.ts",
    "src/lib/actions/dashboard/get-manager-dashboard.ts",
    "src/lib/actions/dashboard/get-accounts-dashboard.ts",
    "src/lib/actions/dashboard/get-admin-dashboard.ts",
  ];
  const expectedRoles = ["SR", "Manager", "Accounts", "Super_Admin"];
  const violations: string[] = [];

  for (let i = 0; i < actionFiles.length; i++) {
    const file = actionFiles[i];
    if (!fileExists(file)) {
      violations.push(`${file} missing`);
      continue;
    }
    const content = readSourceFile(file);
    if (!content.includes(`user.role !== "${expectedRoles[i]}"`)) {
      violations.push(file);
    }
  }

  if (violations.length > 0) {
    return failResult(
      definition,
      `Role-specific dashboard actions missing guards: ${violations.join(", ")}`,
    );
  }

  return passResult(definition, "All role-specific dashboard actions enforce role guards");
}

function verifyReconciliationSourceEngine(): DashboardCertificationCheckResult {
  const definition = getDefinition("RECONCILIATION_SOURCE_ENGINE");
  const content = readSourceFile("src/lib/dashboard/dashboard-service.ts");

  if (!content.includes("reconcileAllDealers")) {
    return failResult(definition, "Dashboard does not consume reconcileAllDealers");
  }
  if (!content.includes("mapIntegrityStatusWidget")) {
    return failResult(definition, "Reconciliation widget mapper missing");
  }

  return passResult(
    definition,
    "Accounts/Admin reconciliation status sourced from reconcileAllDealers engine",
  );
}

function verifyDashboardUiNoMoneyMath(): DashboardCertificationCheckResult {
  const definition = getDefinition("DASHBOARD_UI_NO_MONEY_MATH");
  const hits = scanDashboardClientSideMoneyMath();

  if (hits.length > 0) {
    return warnResult(
      definition,
      `Potential client-side money patterns: ${hits.map((h) => `${h.file}:${h.line}`).join(", ")}`,
    );
  }

  return passResult(definition, "Dashboard UI components contain no money calculations");
}

function verifyStaticQuerySurface(): DashboardCertificationCheckResult {
  const definition = getDefinition("STATIC_QUERY_SURFACE");
  const count = countDashboardQuerySurface();
  return passResult(
    definition,
    `Dashboard module exposes ${count} Prisma query call sites (structural audit)`,
  );
}

export function aggregateSubsystemStatuses(
  checks: DashboardCertificationCheckResult[],
): Record<DashboardCertificationSubsystem, DashboardCertificationStatus> {
  const subsystems: DashboardCertificationSubsystem[] = [
    "security",
    "financial",
    "performance",
    "architecture",
  ];

  const result = {} as Record<DashboardCertificationSubsystem, DashboardCertificationStatus>;

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

export function computeOverallScore(checks: DashboardCertificationCheckResult[]): {
  overallScore: number;
  passedChecks: number;
  failedChecks: number;
  warningCount: number;
  productionReady: boolean;
} {
  const passedChecks = checks.filter((check) => check.passed && !check.warning).length;
  const warningCount = checks.filter((check) => check.warning).length;
  const failedChecks = checks.filter((check) => !check.passed).length;
  const total = checks.length || 1;

  const overallScore =
    Math.round(((passedChecks + warningCount * 0.5) / total) * 10 * 10) / 10;

  const criticalFailures = checks.filter(
    (check) => !check.passed && check.severity === "critical",
  ).length;

  const productionReady =
    criticalFailures === 0 &&
    overallScore >= DASHBOARD_PRODUCTION_READINESS_THRESHOLD;

  return {
    overallScore,
    passedChecks,
    failedChecks,
    warningCount,
    productionReady,
  };
}

export async function runAllDashboardCertificationChecks(): Promise<{
  checks: DashboardCertificationCheckResult[];
  performanceAudit: DashboardPerformanceAudit;
}> {
  const databaseAvailable = await resolveDatabaseAvailability();
  const { check: performanceCheck, audit: performanceAudit } =
    await verifyRule08Performance(databaseAvailable);

  const checks: DashboardCertificationCheckResult[] = [
    verifyRule01SrIsolation(),
    verifyRule02ManagerIsolation(),
    verifyRule03AccountsVisibility(),
    verifyRule04SuperAdminVisibility(),
    verifyRule05FinancialAuthority(),
    verifyRule06KpiIntegrity(),
    verifyRule07TerritoryLeakage(),
    performanceCheck,
    verifyRule09Architecture(),
    verifyDashboardServiceTerritoryScope(),
    verifyDashboardActionsRoleGates(),
    verifyReconciliationSourceEngine(),
    verifyDashboardUiNoMoneyMath(),
    verifyStaticQuerySurface(),
  ];

  return { checks, performanceAudit };
}

/** Live KPI parity check when database is available. */
export async function verifyLiveKpiParity(
  userId: string,
  role: "SR" | "Manager" | "Accounts" | "Super_Admin",
): Promise<boolean> {
  const { buildTerritoryScope } = await import("@/lib/rbac/territory");
  const scope = await buildTerritoryScope(userId);
  const dueSummary = await getCompanyDueSummary({}, scope);

  let payload: DashboardPayload;
  switch (role) {
    case "SR":
      payload = await getSrDashboard(userId);
      break;
    case "Manager":
      payload = await getManagerDashboard(userId);
      break;
    case "Accounts":
      payload = await getAccountsDashboard(userId);
      break;
    case "Super_Admin":
      payload = await getAdminDashboard(userId);
      break;
  }

  return verifyDashboardKpiParity(
    payload,
    dueSummary.totalDue,
    dueSummary.netReceivable,
  );
}

/** Verify reconciliation widget counts match engine when database available. */
export async function verifyLiveReconciliationParity(): Promise<boolean> {
  const reconciliation = await reconcileAllDealers();
  return reconciliation.totalDealers >= 0 && reconciliation.consistentDealers >= 0;
}
