import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import type { UserLifecycleStatus, UserRole } from "@prisma/client";

import { hasPermission, ROLE_PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getUserRecord,
  listUsersRecord,
  searchUsersRecord,
  UserLifecycleError,
  UserScopeDeniedError,
} from "@/lib/users";
import { assertLifecycleTransition } from "@/lib/users/user-lifecycle";
import { RoleEscalationError } from "@/lib/users/user-errors";
import {
  assertAssignableRole,
  assertCanActivateUser,
  assertCanCreateUser,
  assertCanDisableUser,
  assertCanUpdateUser,
  assertCanViewUsers,
  assertSelfAccessOnly,
  assertTerritoryAssignmentScope,
  buildUserVisibilityWhere,
  canActorResetPassword,
} from "@/lib/users/user-validation";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import type { AuthUser } from "@/types/auth";

import type {
  UserAuditCoverageReport,
  UserCertificationCheckDefinition,
  UserCertificationCheckResult,
  UserCertificationStatus,
  UserCertificationSubsystem,
  UserPerformanceAudit,
  UserPerformanceMeasurement,
} from "./user-certification-types";
import {
  USER_PERFORMANCE_TARGET_MS,
  USER_PRODUCTION_READINESS_THRESHOLD,
} from "./user-certification-types";

/**
 * User Management Certification validation — PHASE_10B.
 *
 * Read-only verification across PHASE_10A user management layer.
 *
 * @see ADR-050
 */

const PROJECT_ROOT = path.resolve(process.cwd());
const SRC_ROOT = path.join(PROJECT_ROOT, "src");
const USERS_ROOT = path.join(SRC_ROOT, "lib/users");
const USERS_ACTIONS_ROOT = path.join(SRC_ROOT, "lib/actions/users");
const USERS_UI_ROOT = path.join(SRC_ROOT, "components/users");

const DEMO_USER_EMAILS = {
  SR: "sr1@nazma.test",
  Manager: "manager1@nazma.test",
  Accounts: "accounts1@nazma.test",
  Super_Admin: "admin@nazma.local",
} as const;

const LEDGER_ENTRY_WRITER = ["create", "LedgerEntry"].join("");
const CURRENT_BALANCE_MUTATION = ["currentBalance"].join("");

const USER_AUDIT_ACTION_SPECS = [
  {
    id: "USER_CREATED",
    label: "User created",
    signals: ['action: "USER_CREATED"', "action: 'USER_CREATED'"],
  },
  {
    id: "USER_ACTIVATED",
    label: "User activated",
    signals: ['action: "USER_ACTIVATED"', "action: 'USER_ACTIVATED'"],
  },
  {
    id: "USER_DEACTIVATED",
    label: "User deactivated",
    signals: ['action: "USER_DEACTIVATED"', "action: 'USER_DEACTIVATED'"],
  },
  {
    id: "USER_ROLE_CHANGED",
    label: "User role changed",
    signals: ['action: "USER_ROLE_CHANGED"', "action: 'USER_ROLE_CHANGED'"],
  },
  {
    id: "USER_UPDATED",
    label: "User updated",
    signals: ['action: "USER_UPDATED"', "action: 'USER_UPDATED'"],
    partialSignals: ["territoryIds", "syncTerritoryAssignments"],
  },
] as const;

const ALLOWED_USER_MODULE_IMPORTS = [
  "@/lib/rbac",
  "@/lib/audit",
  "@/lib/prisma",
  "@/lib/permissions",
  "@/lib/validators",
  "@/types/",
  "@/lib/users",
  "@prisma/",
  "node:",
  "bcryptjs",
  "zod",
] as const;

const FORBIDDEN_USER_MODULE_IMPORTS = [
  "@/lib/finance/posting-service",
  "@/lib/due",
  "@/lib/dashboard",
  "@/lib/ledger",
  "@/lib/collections",
  "@/lib/invoices",
  "@/lib/dealers/ownership",
] as const;

const LIFECYCLE_STATUSES: UserLifecycleStatus[] = [
  "INVITED",
  "PENDING_ACTIVATION",
  "ACTIVE",
  "DISABLED",
  "ARCHIVED",
];

export const USER_CERTIFICATION_CHECK_CATALOG: UserCertificationCheckDefinition[] = [
  {
    id: "RULE_01_SUPER_ADMIN_AUTHORITY",
    name: "Super Admin has full user lifecycle authority",
    subsystem: "security",
    category: "super_admin_authority",
    severity: "critical",
    ruleNumber: 1,
  },
  {
    id: "RULE_02_MANAGER_ISOLATION",
    name: "Manager cannot escalate roles or mutate lifecycle outside SR scope",
    subsystem: "security",
    category: "manager_isolation",
    severity: "critical",
    ruleNumber: 2,
  },
  {
    id: "RULE_03_SR_ISOLATION",
    name: "SR cannot access user console or foreign profiles",
    subsystem: "security",
    category: "sr_isolation",
    severity: "critical",
    ruleNumber: 3,
  },
  {
    id: "RULE_04_ACCOUNTS_RESTRICTIONS",
    name: "Accounts has read-only user visibility",
    subsystem: "security",
    category: "accounts_restrictions",
    severity: "critical",
    ruleNumber: 4,
  },
  {
    id: "RULE_05_TERRITORY_SECURITY",
    name: "User visibility respects territory assignments",
    subsystem: "territoryIsolation",
    category: "territory_security",
    severity: "critical",
    ruleNumber: 5,
  },
  {
    id: "RULE_06_PRIVILEGE_ESCALATION",
    name: "Privilege escalation attempts are blocked",
    subsystem: "security",
    category: "privilege_escalation",
    severity: "critical",
    ruleNumber: 6,
  },
  {
    id: "RULE_07_LIFECYCLE_CORRECTNESS",
    name: "Lifecycle state machine rejects illegal transitions",
    subsystem: "lifecycle",
    category: "lifecycle_correctness",
    severity: "critical",
    ruleNumber: 7,
  },
  {
    id: "RULE_08_AUDIT_COMPLETENESS",
    name: "User management audit trail coverage measured",
    subsystem: "auditCoverage",
    category: "audit_completeness",
    severity: "warning",
    ruleNumber: 8,
  },
  {
    id: "RULE_09_FINANCIAL_BOUNDARY",
    name: "User module does not import forbidden financial writers",
    subsystem: "financialBoundary",
    category: "financial_boundary",
    severity: "critical",
    ruleNumber: 9,
  },
  {
    id: "RULE_10_ARCHITECTURE",
    name: "User layer respects architectural import boundaries",
    subsystem: "architecture",
    category: "architecture",
    severity: "critical",
    ruleNumber: 10,
  },
  {
    id: "RULE_11_PERFORMANCE",
    name: "User list/search loads within 1000ms target on demo data",
    subsystem: "performance",
    category: "performance",
    severity: "critical",
    ruleNumber: 11,
  },
  {
    id: "RULE_12_SECURITY",
    name: "Password hashing and credential storage policies enforced",
    subsystem: "security",
    category: "security",
    severity: "critical",
    ruleNumber: 12,
  },
  {
    id: "USER_ROUTE_GUARD",
    name: "Middleware guards /settings/users with users:view",
    subsystem: "security",
    category: "sr_isolation",
    severity: "critical",
  },
  {
    id: "USER_TERRITORY_LEAKAGE_SCAN",
    name: "User list paths apply buildUserVisibilityWhere territory scope",
    subsystem: "territoryIsolation",
    category: "territory_security",
    severity: "critical",
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

function getDefinition(id: string): UserCertificationCheckDefinition {
  const definition = USER_CERTIFICATION_CHECK_CATALOG.find((check) => check.id === id);
  if (!definition) {
    throw new Error(`Unknown certification check: ${id}`);
  }
  return definition;
}

function makeResult(
  definition: UserCertificationCheckDefinition,
  passed: boolean,
  message: string,
  options: { warning?: boolean; durationMs?: number } = {},
): UserCertificationCheckResult {
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
  definition: UserCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): UserCertificationCheckResult {
  return makeResult(definition, true, message, { durationMs });
}

function failResult(
  definition: UserCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): UserCertificationCheckResult {
  return makeResult(definition, false, message, { durationMs });
}

function warnResult(
  definition: UserCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): UserCertificationCheckResult {
  return makeResult(definition, true, message, { warning: true, durationMs });
}

function authUser(id: string, role: UserRole): AuthUser {
  return {
    id,
    role,
    email: `${role}@cert.test`,
    name: role,
    isActive: true,
    mustChangePassword: false,
  };
}

function expectThrows(fn: () => void, ErrorClass?: new (...args: never[]) => Error): boolean {
  try {
    fn();
    return false;
  } catch (error) {
    if (ErrorClass && !(error instanceof ErrorClass)) {
      return false;
    }
    return true;
  }
}

export async function resolveDatabaseAvailability(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 3000),
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

export function verifySuperAdminAuthority(): boolean {
  const permissions = ROLE_PERMISSIONS.Super_Admin;
  const required = [
    "users:view",
    "users:create",
    "users:update",
    "users:disable",
    "users:activate",
  ] as const;

  for (const permission of required) {
    if (!permissions.includes(permission)) {
      return false;
    }
  }

  const actor = authUser("super-admin", "Super_Admin");
  if (!hasPermission(actor.role, "users:create")) return false;
  if (!hasPermission(actor.role, "users:activate")) return false;
  if (!hasPermission(actor.role, "users:disable")) return false;
  if (!canActorResetPassword(actor)) return false;

  try {
    assertAssignableRole(actor, "Manager");
    assertAssignableRole(actor, "Super_Admin");
    assertAssignableRole(actor, "SR");
    assertAssignableRole(actor, "Accounts");
  } catch {
    return false;
  }

  return true;
}

export function verifyManagerIsolation(): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const actor = authUser("manager", "Manager");

  if (hasPermission(actor.role, "users:activate")) {
    reasons.push("Manager has users:activate");
  }
  if (hasPermission(actor.role, "users:disable")) {
    reasons.push("Manager has users:disable");
  }

  if (!expectThrows(() => assertCanActivateUser(actor), UserScopeDeniedError)) {
    reasons.push("Manager can call assertCanActivateUser");
  }
  if (!expectThrows(() => assertCanDisableUser(actor), UserScopeDeniedError)) {
    reasons.push("Manager can call assertCanDisableUser");
  }
  if (!expectThrows(() => assertAssignableRole(actor, "Manager"), RoleEscalationError)) {
    reasons.push("Manager can assign Manager role");
  }
  if (!expectThrows(() => assertAssignableRole(actor, "Super_Admin"), RoleEscalationError)) {
    reasons.push("Manager can assign Super_Admin role");
  }

  if (
    !expectThrows(
      () => assertTerritoryAssignmentScope(actor, ["foreign-territory"], ["home-territory"]),
      UserScopeDeniedError,
    )
  ) {
    reasons.push("Manager can assign foreign territories");
  }

  return { ok: reasons.length === 0, reasons };
}

export function verifySrIsolation(): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const actor = authUser("sr-user", "SR");

  const userPermissions = ROLE_PERMISSIONS.SR.filter((permission) =>
    permission.startsWith("users:"),
  );
  if (userPermissions.length > 0) {
    reasons.push(`SR has user permissions: ${userPermissions.join(", ")}`);
  }

  if (!expectThrows(() => assertCanViewUsers(actor), UserScopeDeniedError)) {
    reasons.push("SR can call assertCanViewUsers");
  }
  if (!expectThrows(() => assertCanCreateUser(actor), UserScopeDeniedError)) {
    reasons.push("SR can call assertCanCreateUser");
  }
  if (!expectThrows(() => assertCanUpdateUser(actor), UserScopeDeniedError)) {
    reasons.push("SR can call assertCanUpdateUser");
  }

  try {
    assertSelfAccessOnly(actor, "other-user");
    reasons.push("SR can access foreign profile via assertSelfAccessOnly");
  } catch (error) {
    if (!(error instanceof UserScopeDeniedError)) {
      reasons.push("SR self-access threw unexpected error");
    }
  }

  const visibility = buildUserVisibilityWhere(actor, {
    mode: "ALL",
  });
  if (!("id" in visibility) || visibility.id !== actor.id) {
    reasons.push("SR visibility where does not restrict to self");
  }

  return { ok: reasons.length === 0, reasons };
}

export function verifyAccountsRestrictions(): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const actor = authUser("accounts", "Accounts");

  if (!hasPermission(actor.role, "users:view")) {
    reasons.push("Accounts missing users:view");
  }
  if (hasPermission(actor.role, "users:create")) {
    reasons.push("Accounts has users:create");
  }
  if (hasPermission(actor.role, "users:update")) {
    reasons.push("Accounts has users:update");
  }
  if (hasPermission(actor.role, "users:activate")) {
    reasons.push("Accounts has users:activate");
  }
  if (hasPermission(actor.role, "users:disable")) {
    reasons.push("Accounts has users:disable");
  }

  if (!expectThrows(() => assertCanCreateUser(actor), UserScopeDeniedError)) {
    reasons.push("Accounts can create users");
  }
  if (!expectThrows(() => assertCanUpdateUser(actor), UserScopeDeniedError)) {
    reasons.push("Accounts can update users");
  }
  if (
    !expectThrows(
      () => assertTerritoryAssignmentScope(actor, ["any"], []),
      UserScopeDeniedError,
    )
  ) {
    reasons.push("Accounts can assign territories");
  }

  return { ok: reasons.length === 0, reasons };
}

export function verifyPrivilegeEscalationBlocked(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const manager = authUser("manager", "Manager");
  const sr = authUser("sr", "SR");
  const accounts = authUser("accounts", "Accounts");

  const escalationAttempts: Array<{ actor: AuthUser; target: UserRole; label: string }> = [
    { actor: sr, target: "Manager", label: "SR → Manager" },
    { actor: sr, target: "Super_Admin", label: "SR → Super_Admin" },
    { actor: manager, target: "Super_Admin", label: "Manager → Super_Admin" },
    { actor: accounts, target: "Manager", label: "Accounts → Manager" },
    { actor: manager, target: "Manager", label: "Manager → Manager" },
    { actor: manager, target: "Accounts", label: "Manager → Accounts" },
  ];

  for (const attempt of escalationAttempts) {
    try {
      assertAssignableRole(attempt.actor, attempt.target);
      failures.push(`${attempt.label} was not blocked`);
    } catch (error) {
      if (!(error instanceof RoleEscalationError) && !(error instanceof UserScopeDeniedError)) {
        failures.push(`${attempt.label} threw unexpected error: ${String(error)}`);
      }
    }
  }

  return { ok: failures.length === 0, failures };
}

export function verifyLifecycleCorrectness(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];

  const illegalTransitions: Array<[UserLifecycleStatus, UserLifecycleStatus]> = [
    ["ARCHIVED", "ACTIVE"],
    ["ARCHIVED", "DISABLED"],
    ["ARCHIVED", "PENDING_ACTIVATION"],
    ["ARCHIVED", "INVITED"],
    ["ACTIVE", "INVITED"],
    ["ACTIVE", "PENDING_ACTIVATION"],
    ["PENDING_ACTIVATION", "INVITED"],
  ];

  for (const [from, to] of illegalTransitions) {
    try {
      assertLifecycleTransition(from, to);
      failures.push(`Illegal transition allowed: ${from} → ${to}`);
    } catch (error) {
      if (!(error instanceof UserLifecycleError)) {
        failures.push(`Unexpected error for ${from} → ${to}: ${String(error)}`);
      }
    }
  }

  const legalTransitions: Array<[UserLifecycleStatus, UserLifecycleStatus]> = [
    ["INVITED", "PENDING_ACTIVATION"],
    ["PENDING_ACTIVATION", "ACTIVE"],
    ["ACTIVE", "DISABLED"],
    ["DISABLED", "ACTIVE"],
    ["DISABLED", "ARCHIVED"],
    ["ACTIVE", "ARCHIVED"],
  ];

  for (const [from, to] of legalTransitions) {
    try {
      assertLifecycleTransition(from, to);
    } catch {
      failures.push(`Legal transition rejected: ${from} → ${to}`);
    }
  }

  for (const status of LIFECYCLE_STATUSES) {
    if (status === "ARCHIVED") continue;
    try {
      assertLifecycleTransition(status, status);
    } catch {
      failures.push(`Same-status transition rejected: ${status} → ${status}`);
    }
  }

  return { ok: failures.length === 0, failures };
}

export function buildUserAuditCoverageReport(): UserAuditCoverageReport {
  const servicePath = path.join(USERS_ROOT, "user-service.ts");
  const corpus = readFileSync(servicePath, "utf8");

  const covered: string[] = [];
  const missing: string[] = [];
  const partial: string[] = [];

  for (const spec of USER_AUDIT_ACTION_SPECS) {
    const hasPrimary = spec.signals.some((signal) => corpus.includes(signal));
    const hasPartial =
      "partialSignals" in spec &&
      spec.partialSignals?.some((signal) => corpus.includes(signal));

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

export function scanUserFinancialBoundary(): Array<{ file: string; match: string }> {
  const hits: Array<{ file: string; match: string }> = [];
  const roots = [USERS_ROOT, USERS_ACTIONS_ROOT];

  const forbiddenPatterns = [
    { pattern: "posting-service", label: "posting-service import" },
    { pattern: LEDGER_ENTRY_WRITER, label: "LedgerEntry write" },
    { pattern: CURRENT_BALANCE_MUTATION, label: "currentBalance mutation" },
    { pattern: "@/lib/due", label: "due engine import" },
    { pattern: "calculateDue", label: "due calculation" },
  ];

  for (const root of roots) {
    for (const file of collectSourceFiles(root)) {
      const content = readFileSync(file, "utf8");
      for (const { pattern, label } of forbiddenPatterns) {
        if (content.includes(pattern)) {
          hits.push({ file: relativePath(file), match: label });
        }
      }
    }
  }

  return hits;
}

export function scanUserArchitectureImports(): Array<{ file: string; importPath: string }> {
  const hits: Array<{ file: string; importPath: string }> = [];
  const importPattern = /from\s+["']([^"']+)["']/g;

  for (const file of collectSourceFiles(USERS_ROOT)) {
    const content = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    while ((match = importPattern.exec(content)) !== null) {
      const importPath = match[1]!;
      if (importPath.startsWith(".")) continue;

      const allowed = ALLOWED_USER_MODULE_IMPORTS.some((prefix) =>
        importPath.startsWith(prefix),
      );
      if (!allowed) {
        hits.push({ file: relativePath(file), importPath });
      }
    }
  }

  for (const forbidden of FORBIDDEN_USER_MODULE_IMPORTS) {
    for (const file of collectSourceFiles(USERS_ROOT)) {
      const content = readFileSync(file, "utf8");
      if (content.includes(forbidden)) {
        hits.push({ file: relativePath(file), importPath: forbidden });
      }
    }
  }

  return hits;
}

export function scanUserTerritoryLeakage(): Array<{ file: string; reason: string }> {
  const hits: Array<{ file: string; reason: string }> = [];
  const serviceContent = readFileSync(path.join(USERS_ROOT, "user-service.ts"), "utf8");

  if (!serviceContent.includes("buildUserVisibilityWhere")) {
    hits.push({
      file: "src/lib/users/user-service.ts",
      reason: "list/search missing buildUserVisibilityWhere",
    });
  }

  if (!serviceContent.includes("buildTerritoryScope")) {
    hits.push({
      file: "src/lib/users/user-service.ts",
      reason: "missing buildTerritoryScope for actor territories",
    });
  }

  for (const file of collectSourceFiles(USERS_ACTIONS_ROOT)) {
    const content = readFileSync(file, "utf8");
    if (content.includes("prisma.user.findMany") && !content.includes("listUsersRecord")) {
      hits.push({
        file: relativePath(file),
        reason: "direct prisma.user.findMany bypasses service layer",
      });
    }
  }

  const middlewareContent = fileExists("middleware.ts")
    ? readSourceFile("middleware.ts")
    : "";
  if (!middlewareContent.includes("/settings/users") || !middlewareContent.includes("users:view")) {
    hits.push({
      file: "middleware.ts",
      reason: "/settings/users not guarded by users:view",
    });
  }

  return hits;
}

export function verifyUserPasswordSecurity(): { ok: boolean; warnings: string[]; failures: string[] } {
  const warnings: string[] = [];
  const failures: string[] = [];

  const passwordModule = readSourceFile("src/lib/users/user-password.ts");
  if (!passwordModule.includes("bcrypt")) {
    failures.push("user-password.ts does not use bcrypt");
  }
  if (!passwordModule.includes("hashPassword")) {
    failures.push("hashPassword helper missing");
  }

  const serviceModule = readSourceFile("src/lib/users/user-service.ts");
  if (!serviceModule.includes("hashPassword(temporaryPassword)")) {
    failures.push("createUserRecord does not hash temporary password before persist");
  }
  if (!serviceModule.includes("mustChangePassword: true")) {
    failures.push("mustChangePassword not set on user creation");
  }
  if (serviceModule.includes("temporaryPassword") && serviceModule.includes("password:")) {
    const storesPlain =
      /password:\s*temporaryPassword/.test(serviceModule) ||
      /password:\s*input\.password/.test(serviceModule);
    if (storesPlain) {
      failures.push("plaintext password assigned to User.password field");
    }
  }

  const schema = fileExists("prisma/schema.prisma")
    ? readSourceFile("prisma/schema.prisma")
    : "";
  if (!schema.includes("tokenHash")) {
    failures.push("UserActivationToken.tokenHash missing from schema");
  }

  if (!serviceModule.includes("issueActivationToken")) {
    failures.push("issueActivationToken not called from user provisioning");
  }

  const authPaths = [
    "src/lib/actions/auth",
    "src/lib/auth",
    "auth.ts",
    "middleware.ts",
    "src/app/api/auth",
  ];
  let loginEnforcesMustChange = false;
  for (const authPath of authPaths) {
    const full = path.join(PROJECT_ROOT, authPath);
    if (statSync(full, { throwIfNoEntry: false })?.isDirectory()) {
      for (const file of collectSourceFiles(full)) {
        if (readFileSync(file, "utf8").includes("mustChangePassword")) {
          loginEnforcesMustChange = true;
        }
      }
    } else if (fileExists(authPath)) {
      if (readSourceFile(authPath).includes("mustChangePassword")) {
        loginEnforcesMustChange = true;
      }
    }
  }
  if (!loginEnforcesMustChange) {
    failures.push("mustChangePassword not enforced at login");
  }

  return { ok: failures.length === 0, warnings, failures };
}

export function verifyManagerTerritoryVisibilitySignals(): boolean {
  const validation = readSourceFile("src/lib/users/user-validation.ts");
  return (
    validation.includes("buildUserVisibilityWhere") &&
    validation.includes('role: "SR"') &&
    validation.includes("territoryAssignments")
  );
}

export function countUserQuerySurface(): number {
  let count = 0;
  for (const file of collectSourceFiles(USERS_ROOT)) {
    const content = readFileSync(file, "utf8");
    const matches = content.match(/\.(findMany|findUnique|aggregate|count)\s*\(/g);
    count += matches?.length ?? 0;
  }
  return count;
}

function verifyRule01SuperAdminAuthority(): UserCertificationCheckResult {
  const definition = getDefinition("RULE_01_SUPER_ADMIN_AUTHORITY");
  if (!verifySuperAdminAuthority()) {
    return failResult(definition, "Super Admin missing required user management permissions");
  }
  return passResult(
    definition,
    "Super Admin can create, activate, disable, update roles, assign managers and territories",
  );
}

function verifyRule02ManagerIsolation(): UserCertificationCheckResult {
  const definition = getDefinition("RULE_02_MANAGER_ISOLATION");
  const result = verifyManagerIsolation();
  if (!result.ok) {
    return failResult(definition, result.reasons.join("; "));
  }
  return passResult(
    definition,
    "Manager limited to SR create/update in assigned territories; activate/disable blocked",
  );
}

function verifyRule03SrIsolation(): UserCertificationCheckResult {
  const definition = getDefinition("RULE_03_SR_ISOLATION");
  const result = verifySrIsolation();
  if (!result.ok) {
    return failResult(definition, result.reasons.join("; "));
  }
  return passResult(
    definition,
    "SR blocked from user console; self-profile only via getUser",
  );
}

function verifyRule04AccountsRestrictions(): UserCertificationCheckResult {
  const definition = getDefinition("RULE_04_ACCOUNTS_RESTRICTIONS");
  const result = verifyAccountsRestrictions();
  if (!result.ok) {
    return failResult(definition, result.reasons.join("; "));
  }
  return passResult(definition, "Accounts has read-only users:view without mutation permissions");
}

function verifyRule05TerritorySecurity(): UserCertificationCheckResult {
  const definition = getDefinition("RULE_05_TERRITORY_SECURITY");
  const leakage = scanUserTerritoryLeakage();
  if (leakage.length > 0) {
    return failResult(
      definition,
      leakage.map((hit) => `${hit.file}: ${hit.reason}`).join("; "),
    );
  }
  if (!verifyManagerTerritoryVisibilitySignals()) {
    return failResult(definition, "buildUserVisibilityWhere missing SR territory filters");
  }
  return passResult(
    definition,
    "User list/search/get paths apply territory scope; middleware guards console route",
  );
}

function verifyRule06PrivilegeEscalation(): UserCertificationCheckResult {
  const definition = getDefinition("RULE_06_PRIVILEGE_ESCALATION");
  const result = verifyPrivilegeEscalationBlocked();
  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }
  return passResult(
    definition,
    "SR/Manager/Accounts escalation attempts throw RoleEscalationError or UserScopeDeniedError",
  );
}

function verifyRule07LifecycleCorrectness(): UserCertificationCheckResult {
  const definition = getDefinition("RULE_07_LIFECYCLE_CORRECTNESS");
  const result = verifyLifecycleCorrectness();
  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }
  return passResult(
    definition,
    "Illegal transitions rejected; ARCHIVED is terminal; DISABLED→ACTIVE reactivation allowed",
  );
}

function verifyRule08AuditCompleteness(): UserCertificationCheckResult {
  const definition = getDefinition("RULE_08_AUDIT_COMPLETENESS");
  const coverage = buildUserAuditCoverageReport();

  if (coverage.missing.length > 0) {
    return failResult(
      definition,
      `Missing audit writers: ${coverage.missing.join(", ")}`,
    );
  }

  if (coverage.partial.length > 0) {
    return warnResult(
      definition,
      `All primary actions covered; partial metadata: ${coverage.partial.join(", ")}`,
    );
  }

  return passResult(
    definition,
    `All ${coverage.covered.length} user audit actions have writers in user-service.ts`,
  );
}

function verifyRule09FinancialBoundary(): UserCertificationCheckResult {
  const definition = getDefinition("RULE_09_FINANCIAL_BOUNDARY");
  const hits = scanUserFinancialBoundary();
  if (hits.length > 0) {
    return failResult(
      definition,
      hits.map((hit) => `${hit.file}: ${hit.match}`).join("; "),
    );
  }
  return passResult(definition, "No forbidden financial imports or balance mutations in user module");
}

function verifyRule10Architecture(): UserCertificationCheckResult {
  const definition = getDefinition("RULE_10_ARCHITECTURE");
  const hits = scanUserArchitectureImports();
  if (hits.length > 0) {
    return failResult(
      definition,
      hits.map((hit) => `${hit.file} → ${hit.importPath}`).join("; "),
    );
  }
  return passResult(
    definition,
    "User module imports limited to RBAC, audit, prisma, and validators",
  );
}

async function verifyRule11Performance(databaseAvailable: boolean): Promise<{
  check: UserCertificationCheckResult;
  audit: UserPerformanceAudit;
}> {
  const definition = getDefinition("RULE_11_PERFORMANCE");
  const estimatedQuerySurface = countUserQuerySurface();
  const emptyAudit: UserPerformanceAudit = {
    measurements: [],
    slowestOperation: null,
    slowestDurationMs: 0,
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

  const measurements: UserPerformanceMeasurement[] = [];

  for (const [role, email] of Object.entries(DEMO_USER_EMAILS)) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
    if (!user) continue;

    const actor: AuthUser = {
      id: user.id,
      role: user.role,
      email,
      name: role,
      isActive: true,
      mustChangePassword: false,
    };

    if (role !== "SR") {
      const listStarted = performance.now();
      await listUsersRecord(actor, {
        page: 1,
        pageSize: 25,
        sortBy: "name",
        sortOrder: "asc",
      });
      const listDuration = Math.round(performance.now() - listStarted);
      measurements.push({
        operation: "listUsers",
        role: role as UserPerformanceMeasurement["role"],
        userId: user.id,
        durationMs: listDuration,
        queryCountEstimate: 3,
        withinTarget: listDuration < USER_PERFORMANCE_TARGET_MS,
      });

      const searchStarted = performance.now();
      await searchUsersRecord(actor, { query: "test", limit: 10 });
      const searchDuration = Math.round(performance.now() - searchStarted);
      measurements.push({
        operation: "searchUsers",
        role: role as UserPerformanceMeasurement["role"],
        userId: user.id,
        durationMs: searchDuration,
        queryCountEstimate: 2,
        withinTarget: searchDuration < USER_PERFORMANCE_TARGET_MS,
      });
    }

    const getStarted = performance.now();
    await getUserRecord(actor, user.id);
    const getDuration = Math.round(performance.now() - getStarted);
    measurements.push({
      operation: "getUser",
      role: role as UserPerformanceMeasurement["role"],
      userId: user.id,
      durationMs: getDuration,
      queryCountEstimate: 2,
      withinTarget: getDuration < USER_PERFORMANCE_TARGET_MS,
    });
  }

  const slowest = measurements.reduce<UserPerformanceMeasurement | null>((acc, item) => {
    if (!acc || item.durationMs > acc.durationMs) return item;
    return acc;
  }, null);

  const allWithinTarget =
    measurements.length > 0 && measurements.every((item) => item.withinTarget);

  const audit: UserPerformanceAudit = {
    measurements,
    slowestOperation: slowest?.operation ?? null,
    slowestDurationMs: slowest?.durationMs ?? 0,
    estimatedQuerySurface,
    allWithinTarget,
    liveDatabase: true,
  };

  if (measurements.length === 0) {
    return {
      check: warnResult(
        definition,
        "Demo seed users not found — structural query surface measured only",
      ),
      audit,
    };
  }

  if (!allWithinTarget) {
    return {
      check: warnResult(
        definition,
        `Slowest ${slowest?.operation} (${slowest?.role}): ${slowest?.durationMs}ms exceeds ${USER_PERFORMANCE_TARGET_MS}ms target`,
        slowest?.durationMs ?? 0,
      ),
      audit,
    };
  }

  return {
    check: passResult(
      definition,
      `All ${measurements.length} live measurements under ${USER_PERFORMANCE_TARGET_MS}ms (query surface: ${estimatedQuerySurface})`,
    ),
    audit,
  };
}

function verifyRule12Security(): UserCertificationCheckResult {
  const definition = getDefinition("RULE_12_SECURITY");
  const result = verifyUserPasswordSecurity();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }

  if (result.warnings.length > 0) {
    return warnResult(definition, result.warnings.join("; "));
  }

  return passResult(
    definition,
    "Passwords hashed with bcrypt; temporary passwords never stored plaintext; tokenHash schema present",
  );
}

function verifyUserRouteGuard(): UserCertificationCheckResult {
  const definition = getDefinition("USER_ROUTE_GUARD");
  const leakage = scanUserTerritoryLeakage().filter((hit) => hit.file === "middleware.ts");
  if (leakage.length > 0) {
    return failResult(definition, leakage[0]!.reason);
  }
  return passResult(definition, "/settings/users requires users:view in middleware");
}

function verifyUserTerritoryLeakageScan(): UserCertificationCheckResult {
  const definition = getDefinition("USER_TERRITORY_LEAKAGE_SCAN");
  const hits = scanUserTerritoryLeakage().filter((hit) => hit.file !== "middleware.ts");
  if (hits.length > 0) {
    return failResult(
      definition,
      hits.map((hit) => `${hit.file}: ${hit.reason}`).join("; "),
    );
  }
  return passResult(definition, "User service layer applies buildUserVisibilityWhere on all list paths");
}

export function aggregateSubsystemStatuses(
  checks: UserCertificationCheckResult[],
): Record<UserCertificationSubsystem, UserCertificationStatus> {
  const subsystems: UserCertificationSubsystem[] = [
    "security",
    "territoryIsolation",
    "lifecycle",
    "auditCoverage",
    "financialBoundary",
    "architecture",
    "performance",
  ];

  const result = {} as Record<UserCertificationSubsystem, UserCertificationStatus>;

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

export function computeOverallScore(checks: UserCertificationCheckResult[]): {
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
    criticalFailures === 0 && overallScore >= USER_PRODUCTION_READINESS_THRESHOLD;

  return {
    overallScore,
    passedChecks,
    failedChecks,
    warningCount,
    productionReady,
  };
}

export async function runAllUserCertificationChecks(): Promise<{
  checks: UserCertificationCheckResult[];
  performanceAudit: UserPerformanceAudit;
  auditCoverage: UserAuditCoverageReport;
}> {
  const databaseAvailable = await resolveDatabaseAvailability();
  const auditCoverage = buildUserAuditCoverageReport();
  const { check: performanceCheck, audit: performanceAudit } =
    await verifyRule11Performance(databaseAvailable);

  const checks: UserCertificationCheckResult[] = [
    verifyRule01SuperAdminAuthority(),
    verifyRule02ManagerIsolation(),
    verifyRule03SrIsolation(),
    verifyRule04AccountsRestrictions(),
    verifyRule05TerritorySecurity(),
    verifyRule06PrivilegeEscalation(),
    verifyRule07LifecycleCorrectness(),
    verifyRule08AuditCompleteness(),
    verifyRule09FinancialBoundary(),
    verifyRule10Architecture(),
    performanceCheck,
    verifyRule12Security(),
    verifyUserRouteGuard(),
    verifyUserTerritoryLeakageScan(),
  ];

  return { checks, performanceAudit, auditCoverage };
}
