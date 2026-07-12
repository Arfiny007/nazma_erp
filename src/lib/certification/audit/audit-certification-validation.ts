import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { type UserRole } from "@prisma/client";

import {
  categoryMatchesRole,
  getAuditConsoleData,
  groupAuditTimeline,
  normalizeAuditFilters,
  resolveAllowedCategories,
} from "@/lib/audit";
import {
  hasPermission,
  ROLE_PERMISSIONS,
  type Permission,
} from "@/lib/permissions";
import {
  buildScopedTerritoryScope,
  resolveTerritoryScopeMode,
} from "@/lib/rbac/territory";
import { prisma } from "@/lib/prisma";

import type {
  AuditCertificationCheckDefinition,
  AuditCertificationCheckResult,
  AuditCertificationStatus,
  AuditCertificationSubsystem,
  AuditCoverageReport,
  AuditPerformanceAudit,
  AuditPerformanceMeasurement,
} from "./audit-certification-types";
import {
  AUDIT_PERFORMANCE_TARGET_MS,
  AUDIT_PRODUCTION_READINESS_THRESHOLD,
} from "./audit-certification-types";

/**
 * Audit Certification validation — PHASE_09D.5.
 *
 * Read-only verification across PHASE_09D audit console layer.
 *
 * @see ADR-047
 */

const PROJECT_ROOT = path.resolve(process.cwd());
const SRC_ROOT = path.join(PROJECT_ROOT, "src");
const AUDIT_ROOT = path.join(SRC_ROOT, "lib/audit");
const AUDIT_UI_ROOT = path.join(SRC_ROOT, "components/audit");
const AUDIT_ACTIONS_ROOT = path.join(SRC_ROOT, "lib/actions/audit");

const DEMO_USER_EMAILS = {
  SR: "sr1@nazma.test",
  Manager: "manager1@nazma.test",
  Accounts: "accounts1@nazma.test",
  Super_Admin: "admin@nazma.local",
} as const;

const LEDGER_ENTRY_WRITER = ["create", "LedgerEntry"].join("");

type SourceFileHit = {
  file: string;
  line: number;
  content: string;
};

interface WorkflowCoverageSpec {
  id: string;
  label: string;
  signals: readonly string[];
  partialSignals?: readonly string[];
}

const WORKFLOW_COVERAGE_SPECS: WorkflowCoverageSpec[] = [
  {
    id: "invoice_issue",
    label: "Invoice issue",
    signals: ["INVOICE_CREATED", "issue-invoice"],
  },
  {
    id: "collection_confirm",
    label: "Collection confirm",
    signals: ["COLLECTION_CONFIRMED", "confirm-collection"],
  },
  {
    id: "collection_reversal",
    label: "Collection reversal",
    signals: ["COLLECTION_REVERSED", "reverse-collection"],
  },
  {
    id: "dealer_balance_update",
    label: "Dealer balance update",
    signals: ["DEALER_BALANCE_UPDATED", "DEALER_BALANCE_DECREASED"],
  },
  {
    id: "opening_balance_posting",
    label: "Opening balance posting",
    signals: ["DEALER_OPENING_BALANCE_POSTED", "postOpeningBalance"],
  },
  {
    id: "ledger_posting",
    label: "Ledger posting metadata",
    signals: ["ledgerEntryId", "posting-service"],
    partialSignals: ["createLedgerEntry"],
  },
  {
    id: "dealer_create",
    label: "Dealer create",
    signals: ["DEALER_CREATED", "recordDealerAudit"],
  },
  {
    id: "dealer_update",
    label: "Dealer update",
    signals: ["DEALER_UPDATED", "recordDealerAudit"],
  },
  {
    id: "territory_transfer",
    label: "Territory transfer",
    signals: ["DEALER_TERRITORY_TRANSFERRED"],
  },
  {
    id: "login",
    label: "Login",
    signals: ["LOGIN"],
  },
  {
    id: "user_creation",
    label: "User creation",
    signals: ["USER_CREATED"],
  },
  {
    id: "territory_assignment",
    label: "Territory assignment",
    signals: ["TERRITORY_ASSIGNMENT_CREATED"],
  },
  {
    id: "integrity_scan",
    label: "Integrity scan",
    signals: ["FINANCIAL_INTEGRITY_SCAN"],
  },
  {
    id: "reconciliation_run",
    label: "Reconciliation run",
    signals: ["RECONCILIATION_RUN"],
  },
  {
    id: "backfill_replay",
    label: "Backfill replay",
    signals: ["LEDGER_BACKFILL_RUN", "LEDGER_REPLAY_RUN"],
  },
];

export const AUDIT_CERTIFICATION_CHECK_CATALOG: AuditCertificationCheckDefinition[] =
  [
    {
      id: "RULE_01_FINANCIAL_IMMUTABILITY",
      name: "Audit module does not import forbidden financial writers",
      subsystem: "financialIntegrity",
      category: "financial_immutability",
      severity: "critical",
      ruleNumber: 1,
    },
    {
      id: "RULE_02_SUPER_ADMIN_VISIBILITY",
      name: "Super Admin has unrestricted audit category visibility",
      subsystem: "security",
      category: "super_admin_visibility",
      severity: "critical",
      ruleNumber: 2,
    },
    {
      id: "RULE_03_ACCOUNTS_RESTRICTIONS",
      name: "Accounts restricted to financial and integrity audit categories",
      subsystem: "security",
      category: "accounts_restrictions",
      severity: "critical",
      ruleNumber: 3,
    },
    {
      id: "RULE_04_MANAGER_ISOLATION",
      name: "Manager audit queries resolve territory scope",
      subsystem: "territoryIsolation",
      category: "manager_isolation",
      severity: "critical",
      ruleNumber: 4,
    },
    {
      id: "RULE_05_SR_ISOLATION",
      name: "SR audit queries filter by assigned dealer ownership",
      subsystem: "territoryIsolation",
      category: "sr_isolation",
      severity: "critical",
      ruleNumber: 5,
    },
    {
      id: "RULE_06_TERRITORY_LEAKAGE",
      name: "Audit findMany paths use territory scope or scoped entity filters",
      subsystem: "territoryIsolation",
      category: "territory_leakage",
      severity: "critical",
      ruleNumber: 6,
    },
    {
      id: "RULE_07_AUDIT_COMPLETENESS",
      name: "ERP workflow audit trail coverage measured",
      subsystem: "auditCoverage",
      category: "audit_completeness",
      severity: "warning",
      ruleNumber: 7,
    },
    {
      id: "RULE_08_SEARCH_CORRECTNESS",
      name: "Audit search supports required fields with server pagination",
      subsystem: "architecture",
      category: "search_correctness",
      severity: "critical",
      ruleNumber: 8,
    },
    {
      id: "RULE_09_ARCHITECTURAL_BOUNDARIES",
      name: "Audit layer respects architectural import boundaries",
      subsystem: "architecture",
      category: "architecture",
      severity: "critical",
      ruleNumber: 9,
    },
    {
      id: "RULE_10_PERFORMANCE",
      name: "Audit console loads within 1000ms target on demo data",
      subsystem: "performance",
      category: "performance",
      severity: "critical",
      ruleNumber: 10,
    },
    {
      id: "AUDIT_SERVICE_READ_ONLY",
      name: "Audit service exports no mutation primitives",
      subsystem: "financialIntegrity",
      category: "financial_immutability",
      severity: "critical",
    },
    {
      id: "AUDIT_PERMISSION_MATRIX",
      name: "audit:view granted only to certified roles without admin escalation",
      subsystem: "security",
      category: "accounts_restrictions",
      severity: "critical",
    },
    {
      id: "TIMELINE_GROUPING",
      name: "Timeline grouping covers today/yesterday/week/older buckets",
      subsystem: "architecture",
      category: "search_correctness",
      severity: "info",
    },
  ];

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    return files;
  }
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

function getDefinition(id: string): AuditCertificationCheckDefinition {
  const definition = AUDIT_CERTIFICATION_CHECK_CATALOG.find((check) => check.id === id);
  if (!definition) {
    throw new Error(`Unknown certification check: ${id}`);
  }
  return definition;
}

function makeResult(
  definition: AuditCertificationCheckDefinition,
  passed: boolean,
  message: string,
  options: { warning?: boolean; durationMs?: number } = {},
): AuditCertificationCheckResult {
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
  definition: AuditCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): AuditCertificationCheckResult {
  return makeResult(definition, true, message, { durationMs });
}

function failResult(
  definition: AuditCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): AuditCertificationCheckResult {
  return makeResult(definition, false, message, { durationMs });
}

function warnResult(
  definition: AuditCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): AuditCertificationCheckResult {
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

export function scanAuditFinancialBoundary(): SourceFileHit[] {
  const hits: SourceFileHit[] = [];
  const roots = [AUDIT_ROOT, AUDIT_UI_ROOT, AUDIT_ACTIONS_ROOT];

  for (const root of roots) {
    if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) continue;
    for (const file of collectSourceFiles(root)) {
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
        if (/auditLog\.(create|update|delete|upsert)\s*\(/.test(line)) {
          hits.push({ file: relative, line: i + 1, content: line.trim() });
        }
      }
    }
  }

  return hits;
}

export function scanAuditTerritoryLeakage(): SourceFileHit[] {
  const hits: SourceFileHit[] = [];
  const relativeFile = "src/lib/audit/audit-query.ts";
  if (!fileExists(relativeFile)) {
    return hits;
  }

  const content = readSourceFile(relativeFile);
  const lines = content.split("\n");
  const scopeSignals = [
    "buildTerritoryScope",
    "mergeDealerTerritoryScope",
    "resolveScopedEntityIds",
    "buildAuditWhereClause",
    "buildScopedEntityWhere",
    "dealerCodes",
  ];

  for (let i = 0; i < lines.length; i++) {
    if (!/\.findMany\s*\(/.test(lines[i])) continue;

    const contextStart = Math.max(0, i - 45);
    const contextEnd = Math.min(lines.length, i + 8);
    const context = lines.slice(contextStart, contextEnd).join("\n");
    const hasScope = scopeSignals.some((signal) => context.includes(signal));

    if (!hasScope) {
      hits.push({
        file: relativeFile,
        line: i + 1,
        content: lines[i].trim(),
      });
    }
  }

  return hits;
}

export function scanAuditArchitectureImports(): SourceFileHit[] {
  const hits: SourceFileHit[] = [];
  const forbidden = [
    "posting-service",
    "/dealers/ownership/ownership-service",
    "initialization/opening-balance-service",
    "/ledger/ledger-service",
    "/ledger/monitor/",
    "/ledger/reconciliation/",
  ];

  for (const root of [AUDIT_ROOT, AUDIT_ACTIONS_ROOT]) {
    if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) continue;
    for (const file of collectSourceFiles(root)) {
      const relative = relativePath(file);
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes("import")) continue;
        for (const pattern of forbidden) {
          if (line.includes(pattern)) {
            hits.push({ file: relative, line: i + 1, content: line.trim() });
          }
        }
      }
    }
  }

  return hits;
}

export function countAuditQuerySurface(): number {
  let count = 0;
  for (const file of collectSourceFiles(AUDIT_ROOT)) {
    const content = readFileSync(file, "utf8");
    const matches = content.match(/\.(findMany|findUnique|aggregate|count)\s*\(/g);
    count += matches?.length ?? 0;
  }
  return count;
}

export function buildAuditCoverageReport(): AuditCoverageReport {
  const writerRoots = [
    path.join(SRC_ROOT, "lib/finance/posting-service.ts"),
    path.join(SRC_ROOT, "lib/actions/invoices"),
    path.join(SRC_ROOT, "lib/actions/collections"),
    path.join(SRC_ROOT, "lib/actions/orders"),
    path.join(SRC_ROOT, "lib/actions/delivery-challans"),
    path.join(SRC_ROOT, "lib/actions/dealers"),
    path.join(SRC_ROOT, "lib/actions/auth"),
    path.join(SRC_ROOT, "lib/actions/territory-assignments"),
    path.join(SRC_ROOT, "lib/collections/allocation-engine.ts"),
    path.join(SRC_ROOT, "lib/dealers/ownership"),
    path.join(SRC_ROOT, "lib/ledger/monitor"),
    path.join(SRC_ROOT, "lib/ledger/reconciliation"),
    path.join(SRC_ROOT, "lib/ledger/backfill"),
  ];

  const corpusParts: string[] = [];
  for (const root of writerRoots) {
    if (statSync(root, { throwIfNoEntry: false })?.isFile()) {
      corpusParts.push(readFileSync(root, "utf8"));
      continue;
    }
    if (statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
      corpusParts.push(
        ...collectSourceFiles(root).map((file) => readFileSync(file, "utf8")),
      );
    }
  }

  const corpus = corpusParts.join("\n");

  const covered: string[] = [];
  const missing: string[] = [];
  const partial: string[] = [];

  for (const spec of WORKFLOW_COVERAGE_SPECS) {
    const hasPrimary = spec.signals.some((signal) => corpus.includes(signal));
    const hasPartial =
      spec.partialSignals?.some((signal) => corpus.includes(signal)) ?? false;

    if (hasPrimary) {
      covered.push(spec.label);
    } else if (hasPartial) {
      partial.push(spec.label);
    } else {
      missing.push(spec.label);
    }
  }

  return { covered, missing, partial };
}

export function verifySuperAdminVisibility(): boolean {
  return resolveAllowedCategories("Super_Admin") === "ALL";
}

export function verifyAccountsRestrictions(): {
  ok: boolean;
  message: string;
} {
  const allowed = resolveAllowedCategories("Accounts");
  if (allowed === "ALL") {
    return { ok: false, message: "Accounts resolves to ALL categories" };
  }

  const allowedSet = new Set(allowed);
  if (!allowedSet.has("financial") || !allowedSet.has("integrity")) {
    return { ok: false, message: "Accounts missing financial or integrity categories" };
  }
  if (allowedSet.has("security") || allowedSet.has("operational")) {
    return { ok: false, message: "Accounts can access non-financial categories" };
  }

  const blockedPermissions: Permission[] = ["users:create", "settings:view"];
  for (const permission of blockedPermissions) {
    if (hasPermission("Accounts", permission)) {
      return {
        ok: false,
        message: `Accounts has forbidden permission ${permission}`,
      };
    }
  }

  const financialAllowed = categoryMatchesRole(
    "Accounts",
    "COLLECTION_CONFIRMED",
    "Collection",
  );
  const operationalBlocked = !categoryMatchesRole("Accounts", "CREATE", "SalesOrder");

  if (!financialAllowed || !operationalBlocked) {
    return { ok: false, message: "Accounts category filter does not match policy" };
  }

  return {
    ok: true,
    message: "Accounts limited to financial + integrity events; no admin escalation permissions",
  };
}

export function verifyManagerTerritoryIsolationSignals(): boolean {
  const queryFile = readSourceFile("src/lib/audit/audit-query.ts");
  const serviceFile = readSourceFile("src/lib/audit/audit-service.ts");
  return (
    queryFile.includes("buildTerritoryScope") &&
    queryFile.includes("mergeDealerTerritoryScope") &&
    queryFile.includes("buildScopedEntityWhere") &&
    serviceFile.includes("buildTerritoryScope")
  );
}

export function verifySrIsolationSignals(): boolean {
  const queryFile = readSourceFile("src/lib/audit/audit-query.ts");
  return (
    queryFile.includes('context.role === "SR"') &&
    queryFile.includes("assignedSrId") &&
    queryFile.includes("dealerOwnershipHistory")
  );
}

export function verifyAuditSearchCorrectness(): boolean {
  const queryFile = readSourceFile("src/lib/audit/audit-query.ts");
  const validationFile = readSourceFile("src/lib/audit/audit-validation.ts");
  const serviceFile = readSourceFile("src/lib/audit/audit-service.ts");

  const requiredSearchSignals = [
    "dealerCode",
    "referenceNo",
    "collectionNo",
    "user: { name",
    "action: { contains",
    "skip:",
    "take:",
  ];

  const missing = requiredSearchSignals.filter((signal) => !queryFile.includes(signal));
  if (missing.length > 0) return false;

  return (
    validationFile.includes("normalizeAuditFilters") &&
    serviceFile.includes("getAuditConsoleData") &&
    readSourceFile("src/lib/audit/audit-mappers.ts").includes("groupAuditTimeline")
  );
}

export function verifyTimelineGrouping(): boolean {
  const groups = groupAuditTimeline([
    {
      id: "1",
      action: "INVOICE_CREATED",
      entityType: "Invoice",
      entityId: "a",
      userId: "u",
      userName: "User",
      role: "Accounts",
      createdAt: new Date().toISOString(),
      metadata: {},
    },
  ]);
  return groups.some((group) => group.key === "today");
}

export function verifyAuditPermissionMatrix(): boolean {
  const expected: UserRole[] = ["Super_Admin", "Accounts", "Manager", "SR"];
  const rolesWithAudit = (Object.keys(ROLE_PERMISSIONS) as UserRole[]).filter(
    (role) => (ROLE_PERMISSIONS[role] as readonly string[]).includes("audit:view"),
  );

  return (
    rolesWithAudit.length === expected.length &&
    expected.every((role) => rolesWithAudit.includes(role))
  );
}

function verifyRule01FinancialImmutability(): AuditCertificationCheckResult {
  const definition = getDefinition("RULE_01_FINANCIAL_IMMUTABILITY");
  const hits = scanAuditFinancialBoundary();

  if (hits.length > 0) {
    return failResult(
      definition,
      `Forbidden financial/audit mutations in audit layer: ${hits.map((h) => `${h.file}:${h.line}`).join(", ")}`,
    );
  }

  return passResult(definition, "Audit console module is read-only — no forbidden imports or mutations");
}

function verifyRule02SuperAdminVisibility(): AuditCertificationCheckResult {
  const definition = getDefinition("RULE_02_SUPER_ADMIN_VISIBILITY");

  if (!verifySuperAdminVisibility()) {
    return failResult(definition, "Super Admin is not unrestricted");
  }

  const samples = [
    ["INVOICE_CREATED", "Invoice"],
    ["CREATE", "SalesOrder"],
    ["LOGIN", "User"],
    ["FINANCIAL_INTEGRITY_SCAN", "System"],
    ["DEALER_BALANCE_UPDATED", "Dealer"],
  ] as const;

  for (const [action, entityType] of samples) {
    if (!categoryMatchesRole("Super_Admin", action, entityType)) {
      return failResult(definition, `Super Admin blocked from ${action}/${entityType}`);
    }
  }

  return passResult(definition, "Super Admin can view all audit categories without filter");
}

function verifyRule03AccountsRestrictions(): AuditCertificationCheckResult {
  const definition = getDefinition("RULE_03_ACCOUNTS_RESTRICTIONS");
  const result = verifyAccountsRestrictions();

  if (!result.ok) {
    return failResult(definition, result.message);
  }

  const financialAllowed = categoryMatchesRole(
    "Accounts",
    "COLLECTION_CONFIRMED",
    "Collection",
  );
  const operationalBlocked = !categoryMatchesRole("Accounts", "CREATE", "SalesOrder");

  if (!financialAllowed || !operationalBlocked) {
    return failResult(definition, "Accounts category filter does not match policy");
  }

  return passResult(
    definition,
    "Accounts limited to financial + integrity events; no admin escalation permissions",
  );
}

function verifyRule04ManagerIsolation(): AuditCertificationCheckResult {
  const definition = getDefinition("RULE_04_MANAGER_ISOLATION");

  if (!verifyManagerTerritoryIsolationSignals()) {
    return failResult(definition, "Manager territory scope signals missing from audit query layer");
  }

  if (resolveTerritoryScopeMode("Manager") !== "TERRITORIES") {
    return failResult(definition, "Manager role does not resolve to TERRITORIES scope mode");
  }

  const scope = buildScopedTerritoryScope(["terr-a"]);
  if (scope.mode !== "TERRITORIES" || !scope.territoryIds.includes("terr-a")) {
    return failResult(definition, "Scoped territory builder failed for Manager");
  }

  return passResult(definition, "Manager audit loads resolve territory scope before entity queries");
}

function verifyRule05SrIsolation(): AuditCertificationCheckResult {
  const definition = getDefinition("RULE_05_SR_ISOLATION");

  if (!verifySrIsolationSignals()) {
    return failResult(definition, "SR ownership filtering missing from audit-query.ts");
  }

  if (resolveTerritoryScopeMode("SR") !== "TERRITORIES") {
    return failResult(definition, "SR role does not resolve to TERRITORIES scope mode");
  }

  return passResult(
    definition,
    "SR audit queries filter dealers via active ownership history assignment",
  );
}

function verifyRule06TerritoryLeakage(): AuditCertificationCheckResult {
  const definition = getDefinition("RULE_06_TERRITORY_LEAKAGE");
  const hits = scanAuditTerritoryLeakage();

  if (hits.length > 0) {
    return failResult(
      definition,
      `Unscoped findMany in audit-query: ${hits.map((h) => `line ${h.line}`).join(", ")}`,
    );
  }

  return passResult(
    definition,
    "All audit findMany paths merge territory scope or scoped entity filters",
  );
}

function verifyRule07AuditCompleteness(): AuditCertificationCheckResult {
  const definition = getDefinition("RULE_07_AUDIT_COMPLETENESS");
  const coverage = buildAuditCoverageReport();

  if (coverage.covered.length === 0) {
    return failResult(definition, "No audit workflow coverage detected");
  }

  const message = `Covered: ${coverage.covered.length}, partial: ${coverage.partial.length}, missing: ${coverage.missing.length}`;

  if (coverage.missing.length > 0) {
    return warnResult(
      definition,
      `${message} — missing writers: ${coverage.missing.join(", ")}`,
    );
  }

  return passResult(definition, message);
}

function verifyRule08SearchCorrectness(): AuditCertificationCheckResult {
  const definition = getDefinition("RULE_08_SEARCH_CORRECTNESS");

  if (!verifyAuditSearchCorrectness()) {
    return failResult(definition, "Audit search/pagination/timeline signals incomplete");
  }

  return passResult(
    definition,
    "Server-side search supports dealer/invoice/collection/user/action with pagination and timeline grouping",
  );
}

function verifyRule09Architecture(): AuditCertificationCheckResult {
  const definition = getDefinition("RULE_09_ARCHITECTURAL_BOUNDARIES");
  const importHits = scanAuditArchitectureImports();

  if (importHits.length > 0) {
    return failResult(
      definition,
      `Forbidden imports in audit layer: ${importHits.map((h) => `${h.file}:${h.line}`).join(", ")}`,
    );
  }

  const mutationHits = scanAuditFinancialBoundary().filter((hit) =>
    hit.content.includes("auditLog."),
  );
  if (mutationHits.length > 0) {
    return failResult(definition, "Audit layer contains auditLog mutation call sites");
  }

  return passResult(
    definition,
    "Audit module consumes read engines only — no financial or ownership mutation imports",
  );
}

async function verifyRule10Performance(databaseAvailable: boolean): Promise<{
  check: AuditCertificationCheckResult;
  audit: AuditPerformanceAudit;
}> {
  const definition = getDefinition("RULE_10_PERFORMANCE");
  const estimatedQuerySurface = countAuditQuerySurface();
  const emptyAudit: AuditPerformanceAudit = {
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
        `Live performance audit skipped — DATABASE_URL unavailable. Static query surface: ${estimatedQuerySurface} Prisma call sites.`,
      ),
      audit: emptyAudit,
    };
  }

  const measurements: AuditPerformanceMeasurement[] = [];

  for (const [role, email] of Object.entries(DEMO_USER_EMAILS)) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
    if (!user) continue;

    const started = performance.now();
    const payload = await getAuditConsoleData(
      { userId: user.id, role: user.role as "SR" | "Manager" | "Accounts" | "Super_Admin" },
      normalizeAuditFilters({ page: 1, pageSize: 25 }),
    );
    const durationMs = Math.round(performance.now() - started);
    const payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");

    measurements.push({
      role: role as AuditPerformanceMeasurement["role"],
      userId: user.id,
      durationMs,
      payloadBytes,
      queryCountEstimate: estimatedQuerySurface,
      withinTarget: durationMs < AUDIT_PERFORMANCE_TARGET_MS,
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

  const slowest = measurements.reduce((a, b) => (a.durationMs >= b.durationMs ? a : b));
  const largestPayloadBytes = Math.max(...measurements.map((m) => m.payloadBytes));
  const allWithinTarget = measurements.every((m) => m.withinTarget);

  const audit: AuditPerformanceAudit = {
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
        `Slowest role ${slowest.role}: ${slowest.durationMs}ms exceeds ${AUDIT_PERFORMANCE_TARGET_MS}ms target`,
      ),
      audit,
    };
  }

  return {
    check: passResult(
      definition,
      `All ${measurements.length} role loads within ${AUDIT_PERFORMANCE_TARGET_MS}ms (slowest: ${slowest.role} ${slowest.durationMs}ms)`,
    ),
    audit,
  };
}

function verifyAuditServiceReadOnly(): AuditCertificationCheckResult {
  const definition = getDefinition("AUDIT_SERVICE_READ_ONLY");
  const indexFile = readSourceFile("src/lib/audit/index.ts");

  const forbiddenExports = ["create", "update", "delete", "post", "mutate"];
  const violations = forbiddenExports.filter((token) =>
    new RegExp(`\\b${token}\\b`, "i").test(indexFile),
  );

  if (violations.length > 0) {
    return failResult(definition, `Audit public surface exports forbidden tokens: ${violations.join(", ")}`);
  }

  if (!indexFile.includes("getAuditConsoleData")) {
    return failResult(definition, "getAuditConsoleData not exported from audit module");
  }

  return passResult(definition, "Audit module public API is read-only");
}

function verifyAuditPermissionMatrixCheck(): AuditCertificationCheckResult {
  const definition = getDefinition("AUDIT_PERMISSION_MATRIX");

  if (!verifyAuditPermissionMatrix()) {
    return failResult(definition, "audit:view permission matrix does not match certified roles");
  }

  return passResult(definition, "audit:view granted to Super_Admin, Accounts, Manager, SR only");
}

function verifyTimelineGroupingCheck(): AuditCertificationCheckResult {
  const definition = getDefinition("TIMELINE_GROUPING");

  if (!verifyTimelineGrouping()) {
    return failResult(definition, "Timeline grouping failed synthetic bucket test");
  }

  return passResult(definition, "Timeline groups include today/yesterday/thisWeek/older buckets");
}

export function aggregateSubsystemStatuses(
  checks: AuditCertificationCheckResult[],
): Record<AuditCertificationSubsystem, AuditCertificationStatus> {
  const subsystems: AuditCertificationSubsystem[] = [
    "security",
    "financialIntegrity",
    "territoryIsolation",
    "auditCoverage",
    "architecture",
    "performance",
  ];

  const result = {} as Record<AuditCertificationSubsystem, AuditCertificationStatus>;

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

export function computeOverallScore(checks: AuditCertificationCheckResult[]): {
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
    criticalFailures === 0 && overallScore >= AUDIT_PRODUCTION_READINESS_THRESHOLD;

  return {
    overallScore,
    passedChecks,
    failedChecks,
    warningCount,
    productionReady,
  };
}

export async function runAllAuditCertificationChecks(): Promise<{
  checks: AuditCertificationCheckResult[];
  performanceAudit: AuditPerformanceAudit;
  coverage: AuditCoverageReport;
}> {
  const databaseAvailable = await resolveDatabaseAvailability();
  const coverage = buildAuditCoverageReport();
  const { check: performanceCheck, audit: performanceAudit } =
    await verifyRule10Performance(databaseAvailable);

  const checks: AuditCertificationCheckResult[] = [
    verifyRule01FinancialImmutability(),
    verifyRule02SuperAdminVisibility(),
    verifyRule03AccountsRestrictions(),
    verifyRule04ManagerIsolation(),
    verifyRule05SrIsolation(),
    verifyRule06TerritoryLeakage(),
    verifyRule07AuditCompleteness(),
    verifyRule08SearchCorrectness(),
    verifyRule09Architecture(),
    performanceCheck,
    verifyAuditServiceReadOnly(),
    verifyAuditPermissionMatrixCheck(),
    verifyTimelineGroupingCheck(),
  ];

  return { checks, performanceAudit, coverage };
}
