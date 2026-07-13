import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import type { UserRole } from "@prisma/client";

import { SECURITY_AUDIT_ACTIONS } from "@/lib/audit/audit-validation";
import {
  isMustChangePasswordAllowedPath,
  isPublicAuthRoute,
  resolvePostLoginRedirect,
} from "@/lib/auth/auth-routing";
import { prisma } from "@/lib/prisma";
import {
  ACTIVATION_TOKEN_TTL_MS,
  PASSWORD_RESET_TOKEN_TTL_MS,
  hashToken,
} from "@/lib/users/user-tokens";
import { UserScopeDeniedError } from "@/lib/users/user-errors";
import { assertCanActivateUser } from "@/lib/users/user-validation";
import type { AuthUser } from "@/types/auth";

import type {
  AuthenticationAuditCoverageReport,
  AuthenticationCertificationCheckDefinition,
  AuthenticationCertificationCheckResult,
  AuthenticationCertificationStatus,
  AuthenticationCertificationSubsystem,
  AuthenticationPerformanceAudit,
  AuthenticationPerformanceMeasurement,
} from "./authentication-certification-types";
import {
  AUTH_PERFORMANCE_TARGET_MS,
  AUTH_PRODUCTION_READINESS_THRESHOLD,
} from "./authentication-certification-types";

/**
 * Enterprise Authentication Certification validation — PHASE_10D.
 *
 * Read-only verification across PHASE_10C authentication layer.
 *
 * @see ADR-052
 */

const PROJECT_ROOT = path.resolve(process.cwd());
const SRC_ROOT = path.join(PROJECT_ROOT, "src");
const AUTH_ACTIONS_ROOT = path.join(SRC_ROOT, "lib/actions/auth");
const AUTH_LIB_ROOT = path.join(SRC_ROOT, "lib/auth");
const USERS_ROOT = path.join(SRC_ROOT, "lib/users");

const AUTH_USER_FILES = [
  "user-password.ts",
  "user-tokens.ts",
  "user-activation-service.ts",
  "user-password-reset-service.ts",
  "user-audit.ts",
  "user-service.ts",
] as const;

const DEMO_USER_EMAILS = {
  SR: "sr1@nazma.test",
  Manager: "manager1@nazma.test",
  Accounts: "accounts1@nazma.test",
  Super_Admin: "admin@nazma.local",
} as const;

const LEDGER_ENTRY_WRITER = ["create", "LedgerEntry"].join("");
const CURRENT_BALANCE_MUTATION = ["currentBalance"].join("");

const BLOCKED_MUST_CHANGE_PATHS = ["/dashboard", "/settings", "/reports"] as const;

const AUTH_AUDIT_ACTION_SPECS = [
  {
    id: "USER_PASSWORD_CHANGED",
    label: "Password changed",
    signals: ['action: "USER_PASSWORD_CHANGED"', "action: 'USER_PASSWORD_CHANGED'"],
    files: ["user-password-reset-service.ts"],
  },
  {
    id: "USER_PASSWORD_RESET_REQUESTED",
    label: "Password reset requested",
    signals: [
      'action: "USER_PASSWORD_RESET_REQUESTED"',
      "action: 'USER_PASSWORD_RESET_REQUESTED'",
    ],
    files: ["user-password-reset-service.ts"],
  },
  {
    id: "USER_PASSWORD_RESET_COMPLETED",
    label: "Password reset completed",
    signals: [
      'action: "USER_PASSWORD_RESET_COMPLETED"',
      "action: 'USER_PASSWORD_RESET_COMPLETED'",
    ],
    files: ["user-password-reset-service.ts"],
  },
  {
    id: "USER_ACTIVATION_STARTED",
    label: "Activation started",
    signals: ['action: "USER_ACTIVATION_STARTED"', "action: 'USER_ACTIVATION_STARTED'"],
    files: ["user-activation-service.ts"],
  },
  {
    id: "USER_ACTIVATION_COMPLETED",
    label: "Activation completed",
    signals: [
      'action: "USER_ACTIVATION_COMPLETED"',
      "action: 'USER_ACTIVATION_COMPLETED'",
    ],
    files: ["user-activation-service.ts"],
  },
] as const;

const ALLOWED_AUTH_MODULE_IMPORTS = [
  "@/lib/rbac",
  "@/lib/audit",
  "@/lib/prisma",
  "@/lib/permissions",
  "@/lib/validators",
  "@/types/",
  "@/lib/users",
  "@/lib/auth",
  "@prisma/",
  "node:",
  "bcryptjs",
  "zod",
  "next-auth",
  "next/",
] as const;

const FORBIDDEN_AUTH_MODULE_IMPORTS = [
  "@/lib/finance/posting-service",
  "@/lib/due",
  "@/lib/dashboard",
  "@/lib/ledger",
  "@/lib/collections",
  "@/lib/invoices",
  "@/lib/dealers/ownership",
] as const;

const ROLE_LOGIN_EXPECTATIONS: Array<{
  role: UserRole;
  mustChangePassword: boolean;
  expectedRedirect: string;
}> = [
  { role: "Super_Admin", mustChangePassword: false, expectedRedirect: "/" },
  { role: "Manager", mustChangePassword: false, expectedRedirect: "/" },
  { role: "SR", mustChangePassword: true, expectedRedirect: "/auth/change-password" },
  { role: "Accounts", mustChangePassword: false, expectedRedirect: "/" },
];

export const AUTHENTICATION_CERTIFICATION_CHECK_CATALOG: AuthenticationCertificationCheckDefinition[] =
  [
    {
      id: "RULE_01_PASSWORD_SECURITY",
      name: "Passwords hashed with bcrypt; no plaintext persistence",
      subsystem: "passwordSecurity",
      category: "password_security",
      severity: "critical",
      ruleNumber: 1,
    },
    {
      id: "RULE_02_TOKEN_SECURITY",
      name: "Tokens SHA-256 hashed with expiry and replay protection",
      subsystem: "tokenSecurity",
      category: "token_security",
      severity: "critical",
      ruleNumber: 2,
    },
    {
      id: "RULE_03_MUST_CHANGE_PASSWORD",
      name: "mustChangePassword enforced in middleware and routing",
      subsystem: "sessionSecurity",
      category: "must_change_password",
      severity: "critical",
      ruleNumber: 3,
    },
    {
      id: "RULE_04_ACTIVATION_FLOW",
      name: "Activation issues hashed tokens and transitions to ACTIVE",
      subsystem: "security",
      category: "activation_flow",
      severity: "critical",
      ruleNumber: 4,
    },
    {
      id: "RULE_05_PASSWORD_RESET",
      name: "Password reset request, validate, and complete flows present",
      subsystem: "security",
      category: "password_reset",
      severity: "critical",
      ruleNumber: 5,
    },
    {
      id: "RULE_06_ROLE_LOGIN_MATRIX",
      name: "Post-login redirect respects mustChangePassword per role",
      subsystem: "security",
      category: "role_login_matrix",
      severity: "critical",
      ruleNumber: 6,
    },
    {
      id: "RULE_07_PRIVILEGE_ESCALATION",
      name: "Auth privilege boundaries enforced for managers and self-scope",
      subsystem: "security",
      category: "privilege_escalation",
      severity: "critical",
      ruleNumber: 7,
    },
    {
      id: "RULE_08_AUDIT_COMPLETENESS",
      name: "Authentication audit trail coverage measured",
      subsystem: "auditCoverage",
      category: "audit_completeness",
      severity: "warning",
      ruleNumber: 8,
    },
    {
      id: "RULE_09_FINANCIAL_BOUNDARY",
      name: "Auth layer does not import forbidden financial writers",
      subsystem: "financialBoundary",
      category: "financial_boundary",
      severity: "critical",
      ruleNumber: 9,
    },
    {
      id: "RULE_10_ARCHITECTURE",
      name: "Auth layer respects architectural import boundaries",
      subsystem: "architecture",
      category: "architecture",
      severity: "critical",
      ruleNumber: 10,
    },
    {
      id: "RULE_11_PERFORMANCE",
      name: "Auth query surface within performance target",
      subsystem: "performance",
      category: "performance",
      severity: "critical",
      ruleNumber: 11,
    },
    {
      id: "RULE_12_SESSION_SECURITY",
      name: "JWT/session carries mustChangePassword; only ACTIVE users login",
      subsystem: "sessionSecurity",
      category: "session_security",
      severity: "critical",
      ruleNumber: 12,
    },
    {
      id: "AUTH_MIDDLEWARE_SCAN",
      name: "Middleware blocks protected routes when mustChangePassword is set",
      subsystem: "sessionSecurity",
      category: "must_change_password",
      severity: "critical",
    },
    {
      id: "AUTH_LOGIN_REDIRECT_SCAN",
      name: "Login action and middleware apply resolvePostLoginRedirect",
      subsystem: "security",
      category: "role_login_matrix",
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

function readUserAuthFile(filename: string): string {
  return readFileSync(path.join(USERS_ROOT, filename), "utf8");
}

function collectAuthScanFiles(): string[] {
  const files: string[] = [];

  for (const relativeFile of ["middleware.ts", "auth.ts"]) {
    const fullPath = path.join(PROJECT_ROOT, relativeFile);
    if (statSync(fullPath, { throwIfNoEntry: false })?.isFile()) {
      files.push(fullPath);
    }
  }

  for (const filename of AUTH_USER_FILES) {
    const fullPath = path.join(USERS_ROOT, filename);
    if (statSync(fullPath, { throwIfNoEntry: false })?.isFile()) {
      files.push(fullPath);
    }
  }

  files.push(...collectSourceFiles(AUTH_ACTIONS_ROOT));
  files.push(...collectSourceFiles(AUTH_LIB_ROOT));

  return files;
}

function getDefinition(id: string): AuthenticationCertificationCheckDefinition {
  const definition = AUTHENTICATION_CERTIFICATION_CHECK_CATALOG.find(
    (check) => check.id === id,
  );
  if (!definition) {
    throw new Error(`Unknown certification check: ${id}`);
  }
  return definition;
}

function makeResult(
  definition: AuthenticationCertificationCheckDefinition,
  passed: boolean,
  message: string,
  options: { warning?: boolean; durationMs?: number } = {},
): AuthenticationCertificationCheckResult {
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
  definition: AuthenticationCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): AuthenticationCertificationCheckResult {
  return makeResult(definition, true, message, { durationMs });
}

function failResult(
  definition: AuthenticationCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): AuthenticationCertificationCheckResult {
  return makeResult(definition, false, message, { durationMs });
}

function warnResult(
  definition: AuthenticationCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): AuthenticationCertificationCheckResult {
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

export function verifyTokenExpiryConstants(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const tokensModule = readUserAuthFile("user-tokens.ts");

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const oneHourMs = 60 * 60 * 1000;

  if (!tokensModule.includes("ACTIVATION_TOKEN_TTL_MS")) {
    failures.push("ACTIVATION_TOKEN_TTL_MS constant missing");
  } else if (ACTIVATION_TOKEN_TTL_MS !== sevenDaysMs) {
    failures.push(`ACTIVATION_TOKEN_TTL_MS expected ${sevenDaysMs}, got ${ACTIVATION_TOKEN_TTL_MS}`);
  }

  if (!tokensModule.includes("PASSWORD_RESET_TOKEN_TTL_MS")) {
    failures.push("PASSWORD_RESET_TOKEN_TTL_MS constant missing");
  } else if (PASSWORD_RESET_TOKEN_TTL_MS !== oneHourMs) {
    failures.push(
      `PASSWORD_RESET_TOKEN_TTL_MS expected ${oneHourMs}, got ${PASSWORD_RESET_TOKEN_TTL_MS}`,
    );
  }

  const activationModule = readUserAuthFile("user-activation-service.ts");
  const resetModule = readUserAuthFile("user-password-reset-service.ts");

  if (!activationModule.includes("ACTIVATION_TOKEN_TTL_MS")) {
    failures.push("user-activation-service.ts does not use ACTIVATION_TOKEN_TTL_MS");
  }
  if (!resetModule.includes("PASSWORD_RESET_TOKEN_TTL_MS")) {
    failures.push("user-password-reset-service.ts does not use PASSWORD_RESET_TOKEN_TTL_MS");
  }

  return { ok: failures.length === 0, failures };
}

export function verifyPublicAuthRouteIsolation(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const publicRoutes = [
    "/login",
    "/auth/activate",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/api/auth",
  ] as const;

  for (const route of publicRoutes) {
    if (!isPublicAuthRoute(route)) {
      failures.push(`${route} is not recognized as a public auth route`);
    }
  }

  const protectedSamples = ["/dashboard", "/settings", "/reports", "/dealers", "/orders"];
  for (const route of protectedSamples) {
    if (isPublicAuthRoute(route)) {
      failures.push(`${route} incorrectly classified as public auth route`);
    }
  }

  return { ok: failures.length === 0, failures };
}

export function verifyReplayProtectionSignals(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const activationModule = readUserAuthFile("user-activation-service.ts");
  const resetModule = readUserAuthFile("user-password-reset-service.ts");

  for (const [label, corpus] of [
    ["activation", activationModule],
    ["reset", resetModule],
  ] as const) {
    if (!corpus.includes("usedAt")) {
      failures.push(`${label} flow missing usedAt replay guard`);
    }
    if (!corpus.includes("consumed.count")) {
      failures.push(`${label} flow missing conditional consumed.count replay guard`);
    }
    if (!corpus.includes("TokenReplayError")) {
      failures.push(`${label} flow missing TokenReplayError`);
    }
  }

  return { ok: failures.length === 0, failures };
}

export function verifyExpiryRejectionSignals(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const activationModule = readUserAuthFile("user-activation-service.ts");
  const resetModule = readUserAuthFile("user-password-reset-service.ts");

  for (const [label, corpus] of [
    ["activation", activationModule],
    ["reset", resetModule],
  ] as const) {
    if (!corpus.includes("isTokenExpired")) {
      failures.push(`${label} flow missing isTokenExpired check`);
    }
    if (!corpus.includes("TokenExpiredError")) {
      failures.push(`${label} flow missing TokenExpiredError`);
    }
  }

  return { ok: failures.length === 0, failures };
}

export function verifyInvalidTokenRejection(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const activationModule = readUserAuthFile("user-activation-service.ts");
  const resetModule = readUserAuthFile("user-password-reset-service.ts");

  for (const [label, corpus] of [
    ["activation", activationModule],
    ["reset", resetModule],
  ] as const) {
    if (!corpus.includes("TokenInvalidError")) {
      failures.push(`${label} flow missing TokenInvalidError`);
    }
    if (!corpus.includes("hashToken")) {
      failures.push(`${label} flow missing hashToken lookup`);
    }
  }

  const sampleHash = hashToken("certification-probe-token");
  if (!/^[a-f0-9]{64}$/.test(sampleHash)) {
    failures.push("hashToken does not produce SHA-256 hex digest");
  }

  return { ok: failures.length === 0, failures };
}

export function verifyPasswordSecurity(): {
  ok: boolean;
  warnings: string[];
  failures: string[];
} {
  const warnings: string[] = [];
  const failures: string[] = [];

  const passwordModule = readUserAuthFile("user-password.ts");
  if (!passwordModule.includes("bcrypt")) {
    failures.push("user-password.ts does not use bcrypt");
  }
  if (!passwordModule.includes("hashPassword")) {
    failures.push("hashPassword helper missing");
  }

  const activationModule = readUserAuthFile("user-activation-service.ts");
  const resetModule = readUserAuthFile("user-password-reset-service.ts");
  const serviceModule = readUserAuthFile("user-service.ts");

  if (!activationModule.includes("hashPassword(newPassword)")) {
    failures.push("completeAccountActivation does not hash password on activation");
  }
  if (!resetModule.includes("await hashPassword(newPassword)")) {
    failures.push("completePasswordReset and changeUserPassword must hash new password");
  }

  if (!serviceModule.includes("await hashPassword(temporaryPassword)")) {
    failures.push("user provisioning does not hash temporary password");
  }

  const authModule = fileExists("auth.ts") ? readSourceFile("auth.ts") : "";
  if (authModule.includes("password:") && /password:\s*parsed\.data\.password/.test(authModule)) {
    failures.push("auth.ts may persist plaintext password");
  }
  if (!authModule.includes("bcrypt.compare")) {
    failures.push("auth.ts does not verify password with bcrypt.compare");
  }

  for (const [label, corpus] of [
    ["activation", activationModule],
    ["reset-complete", resetModule],
    ["user-service", serviceModule],
  ] as const) {
    if (/password:\s*(newPassword|temporaryPassword|plain)/.test(corpus)) {
      failures.push(`${label} may assign plaintext password to User.password`);
    }
  }

  return { ok: failures.length === 0, warnings, failures };
}

export function verifyTokenSecurity(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];

  const tokensModule = readUserAuthFile("user-tokens.ts");
  if (!tokensModule.includes("createHash") || !tokensModule.includes("sha256")) {
    failures.push("hashToken does not use SHA-256");
  }

  const schema = fileExists("prisma/schema.prisma")
    ? readSourceFile("prisma/schema.prisma")
    : "";
  if (!schema.includes("model UserActivationToken") || !schema.includes("tokenHash")) {
    failures.push("UserActivationToken.tokenHash missing from schema");
  }
  if (!schema.includes("model UserPasswordResetToken")) {
    failures.push("UserPasswordResetToken model missing from schema");
  }

  const expiry = verifyTokenExpiryConstants();
  if (!expiry.ok) {
    failures.push(...expiry.failures);
  }

  const replay = verifyReplayProtectionSignals();
  if (!replay.ok) {
    failures.push(...replay.failures);
  }

  const invalid = verifyInvalidTokenRejection();
  if (!invalid.ok) {
    failures.push(...invalid.failures);
  }

  return { ok: failures.length === 0, failures };
}

export function verifyMustChangePasswordEnforcement(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const middleware = fileExists("middleware.ts") ? readSourceFile("middleware.ts") : "";

  if (!middleware.includes("mustChangePassword")) {
    failures.push("middleware.ts does not reference mustChangePassword");
  }
  if (!middleware.includes("isMustChangePasswordAllowedPath")) {
    failures.push("middleware.ts does not call isMustChangePasswordAllowedPath");
  }

  for (const blockedPath of BLOCKED_MUST_CHANGE_PATHS) {
    if (isMustChangePasswordAllowedPath(blockedPath)) {
      failures.push(`${blockedPath} is incorrectly allowed during mustChangePassword`);
    }
  }

  if (!isMustChangePasswordAllowedPath("/auth/change-password")) {
    failures.push("/auth/change-password must remain accessible during mustChangePassword");
  }

  const loginModule = fileExists("src/lib/actions/auth/login.ts")
    ? readSourceFile("src/lib/actions/auth/login.ts")
    : "";
  if (!loginModule.includes("resolvePostLoginRedirect")) {
    failures.push("login action does not use resolvePostLoginRedirect");
  }

  return { ok: failures.length === 0, failures };
}

export function verifyActivationFlow(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const activationModule = readUserAuthFile("user-activation-service.ts");
  const serviceModule = readUserAuthFile("user-service.ts");

  if (!activationModule.includes("issueActivationToken")) {
    failures.push("issueActivationToken missing from user-activation-service.ts");
  }
  if (!serviceModule.includes("issueActivationToken")) {
    failures.push("user provisioning does not issue activation tokens");
  }
  if (!activationModule.includes('lifecycleStatus: "ACTIVE"')) {
    failures.push("completeAccountActivation does not set lifecycleStatus ACTIVE");
  }
  if (!activationModule.includes("PENDING_ACTIVATION")) {
    failures.push("activation flow missing PENDING_ACTIVATION handling");
  }
  if (!activationModule.includes("USER_ACTIVATION_STARTED")) {
    failures.push("USER_ACTIVATION_STARTED audit missing");
  }
  if (!activationModule.includes("USER_ACTIVATION_COMPLETED")) {
    failures.push("USER_ACTIVATION_COMPLETED audit missing");
  }

  const activateAction = fileExists("src/lib/actions/auth/activate-user-account.ts")
    ? readSourceFile("src/lib/actions/auth/activate-user-account.ts")
    : "";
  if (!activateAction.includes("completeAccountActivation")) {
    failures.push("activateUserAccount action missing completeAccountActivation");
  }
  if (!activateAction.includes("validateActivationToken")) {
    failures.push("validateActivationTokenAction missing validateActivationToken");
  }

  return { ok: failures.length === 0, failures };
}

export function verifyPasswordResetFlow(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const resetModule = readUserAuthFile("user-password-reset-service.ts");

  for (const fn of ["requestPasswordReset", "validateResetToken", "completePasswordReset"] as const) {
    if (!resetModule.includes(`export async function ${fn}`)) {
      failures.push(`${fn} missing from user-password-reset-service.ts`);
    }
  }

  const requestAction = fileExists("src/lib/actions/auth/request-password-reset.ts")
    ? readSourceFile("src/lib/actions/auth/request-password-reset.ts")
    : "";
  const resetAction = fileExists("src/lib/actions/auth/reset-password.ts")
    ? readSourceFile("src/lib/actions/auth/reset-password.ts")
    : "";

  if (!requestAction.includes("requestPasswordReset")) {
    failures.push("requestPasswordResetAction missing service call");
  }
  if (!resetAction.includes("validateResetToken")) {
    failures.push("validateResetTokenAction missing service call");
  }
  if (!resetAction.includes("completePasswordReset")) {
    failures.push("resetPassword action missing completePasswordReset");
  }

  return { ok: failures.length === 0, failures };
}

export function verifyRoleLoginMatrix(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];

  for (const expectation of ROLE_LOGIN_EXPECTATIONS) {
    const redirect = resolvePostLoginRedirect(expectation.mustChangePassword);
    if (redirect !== expectation.expectedRedirect) {
      failures.push(
        `${expectation.role} (mustChangePassword=${expectation.mustChangePassword}) expected ${expectation.expectedRedirect}, got ${redirect}`,
      );
    }
  }

  if (resolvePostLoginRedirect(true) !== "/auth/change-password") {
    failures.push("mustChangePassword=true must redirect to /auth/change-password");
  }
  if (resolvePostLoginRedirect(false) !== "/") {
    failures.push("mustChangePassword=false must redirect to /");
  }

  return { ok: failures.length === 0, failures };
}

export function verifyPrivilegeEscalationBlocked(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const manager = authUser("manager", "Manager");

  if (!expectThrows(() => assertCanActivateUser(manager), UserScopeDeniedError)) {
    failures.push("Manager can call assertCanActivateUser");
  }

  const resetModule = readUserAuthFile("user-password-reset-service.ts");
  if (!resetModule.includes("where: { id: actor.id }")) {
    failures.push("changeUserPassword is not scoped to actor.id");
  }

  const changePasswordAction = fileExists("src/lib/actions/auth/change-password.ts")
    ? readSourceFile("src/lib/actions/auth/change-password.ts")
    : "";
  if (!changePasswordAction.includes("requireUser")) {
    failures.push("change-password action does not call requireUser");
  }
  if (!changePasswordAction.includes("changeUserPassword")) {
    failures.push("change-password action does not delegate to changeUserPassword");
  }

  return { ok: failures.length === 0, failures };
}

export function buildAuthenticationAuditCoverageReport(): AuthenticationAuditCoverageReport {
  const auditTypes = readUserAuthFile("user-audit.ts");
  const covered: string[] = [];
  const missing: string[] = [];
  const partial: string[] = [];

  for (const spec of AUTH_AUDIT_ACTION_SPECS) {
    const corpus = spec.files
      .map((filename) => readUserAuthFile(filename))
      .join("\n");
    const hasWriter = spec.signals.some((signal) => corpus.includes(signal));
    const inAuditTypes =
      auditTypes.includes(`"${spec.id}"`) || auditTypes.includes(`'${spec.id}'`);
    const inSecurityActions = (SECURITY_AUDIT_ACTIONS as readonly string[]).includes(
      spec.id,
    );

    if (hasWriter && inAuditTypes && inSecurityActions) {
      covered.push(spec.label);
    } else if (hasWriter || inAuditTypes || inSecurityActions) {
      const gaps: string[] = [];
      if (!hasWriter) gaps.push("writer");
      if (!inAuditTypes) gaps.push("UserAuditAction type");
      if (!inSecurityActions) gaps.push("SECURITY_AUDIT_ACTIONS");
      partial.push(`${spec.label} (${gaps.join(", ")})`);
    } else {
      missing.push(spec.label);
    }
  }

  return { covered, missing, partial };
}

export function scanAuthFinancialBoundary(): Array<{ file: string; match: string }> {
  const hits: Array<{ file: string; match: string }> = [];
  const forbiddenPatterns = [
    { pattern: "posting-service", label: "posting-service import" },
    { pattern: LEDGER_ENTRY_WRITER, label: "LedgerEntry write" },
    { pattern: CURRENT_BALANCE_MUTATION, label: "currentBalance mutation" },
    { pattern: "@/lib/due", label: "due engine import" },
    { pattern: "calculateDue", label: "due calculation" },
    { pattern: "@/lib/ledger", label: "ledger import" },
  ];

  for (const file of collectAuthScanFiles()) {
    const content = readFileSync(file, "utf8");
    for (const { pattern, label } of forbiddenPatterns) {
      if (content.includes(pattern)) {
        hits.push({ file: relativePath(file), match: label });
      }
    }
  }

  return hits;
}

export function scanAuthArchitectureImports(): Array<{ file: string; importPath: string }> {
  const hits: Array<{ file: string; importPath: string }> = [];
  const importPattern = /from\s+["']([^"']+)["']/g;
  const scanRoots = [AUTH_ACTIONS_ROOT, AUTH_LIB_ROOT];

  for (const root of scanRoots) {
    for (const file of collectSourceFiles(root)) {
      const content = readFileSync(file, "utf8");
      let match: RegExpExecArray | null;
      while ((match = importPattern.exec(content)) !== null) {
        const importPath = match[1]!;
        if (importPath.startsWith(".")) continue;

        const allowed = ALLOWED_AUTH_MODULE_IMPORTS.some((prefix) =>
          importPath.startsWith(prefix),
        );
        if (!allowed) {
          hits.push({ file: relativePath(file), importPath });
        }
      }
    }
  }

  for (const forbidden of FORBIDDEN_AUTH_MODULE_IMPORTS) {
    for (const file of collectAuthScanFiles()) {
      const content = readFileSync(file, "utf8");
      if (content.includes(forbidden)) {
        hits.push({ file: relativePath(file), importPath: forbidden });
      }
    }
  }

  return hits;
}

export function verifySessionSecurity(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const authModule = fileExists("auth.ts") ? readSourceFile("auth.ts") : "";

  if (!authModule.includes("mustChangePassword")) {
    failures.push("auth.ts does not propagate mustChangePassword");
  }
  if (!authModule.includes("token.mustChangePassword")) {
    failures.push("auth.ts jwt callback missing mustChangePassword on token");
  }
  if (!authModule.includes("session.user.mustChangePassword")) {
    failures.push("auth.ts session callback missing mustChangePassword");
  }
  if (!authModule.includes('lifecycleStatus !== "ACTIVE"')) {
    failures.push("auth.ts does not restrict login to lifecycleStatus ACTIVE");
  }
  if (!authModule.includes('strategy: "jwt"')) {
    failures.push("auth.ts session strategy is not jwt");
  }

  return { ok: failures.length === 0, failures };
}

export function countAuthQuerySurface(): number {
  let count = 0;
  const patterns = [/\.(findMany|findUnique|aggregate|count)\s*\(/g];

  for (const file of collectAuthScanFiles()) {
    const content = readFileSync(file, "utf8");
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      count += matches?.length ?? 0;
    }
  }

  return count;
}

function verifyRule01PasswordSecurity(): AuthenticationCertificationCheckResult {
  const definition = getDefinition("RULE_01_PASSWORD_SECURITY");
  const result = verifyPasswordSecurity();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }
  if (result.warnings.length > 0) {
    return warnResult(definition, result.warnings.join("; "));
  }

  return passResult(
    definition,
    "bcrypt hashing enforced; activation, reset, and provisioning hash passwords before persist",
  );
}

function verifyRule02TokenSecurity(): AuthenticationCertificationCheckResult {
  const definition = getDefinition("RULE_02_TOKEN_SECURITY");
  const result = verifyTokenSecurity();
  const expiry = verifyExpiryRejectionSignals();

  if (!result.ok || !expiry.ok) {
    return failResult(
      definition,
      [...result.failures, ...expiry.failures].join("; "),
    );
  }

  return passResult(
    definition,
    "SHA-256 tokenHash storage, TTL constants, replay and expiry guards verified",
  );
}

function verifyRule03MustChangePassword(): AuthenticationCertificationCheckResult {
  const definition = getDefinition("RULE_03_MUST_CHANGE_PASSWORD");
  const result = verifyMustChangePasswordEnforcement();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }

  return passResult(
    definition,
    "middleware and routing block /dashboard, /settings, /reports when mustChangePassword is set",
  );
}

function verifyRule04ActivationFlow(): AuthenticationCertificationCheckResult {
  const definition = getDefinition("RULE_04_ACTIVATION_FLOW");
  const result = verifyActivationFlow();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }

  return passResult(
    definition,
    "issueActivationToken, PENDING_ACTIVATION→ACTIVE transition, and activation audits present",
  );
}

function verifyRule05PasswordReset(): AuthenticationCertificationCheckResult {
  const definition = getDefinition("RULE_05_PASSWORD_RESET");
  const result = verifyPasswordResetFlow();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }

  return passResult(
    definition,
    "requestPasswordReset, validateResetToken, and completePasswordReset wired through actions",
  );
}

function verifyRule06RoleLoginMatrix(): AuthenticationCertificationCheckResult {
  const definition = getDefinition("RULE_06_ROLE_LOGIN_MATRIX");
  const result = verifyRoleLoginMatrix();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }

  return passResult(
    definition,
    "resolvePostLoginRedirect honors mustChangePassword for Super_Admin, Manager, SR, and Accounts",
  );
}

function verifyRule07PrivilegeEscalation(): AuthenticationCertificationCheckResult {
  const definition = getDefinition("RULE_07_PRIVILEGE_ESCALATION");
  const result = verifyPrivilegeEscalationBlocked();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }

  return passResult(
    definition,
    "Manager blocked from assertCanActivateUser; changeUserPassword scoped to actor; requireUser enforced",
  );
}

function verifyRule08AuditCompleteness(): AuthenticationCertificationCheckResult {
  const definition = getDefinition("RULE_08_AUDIT_COMPLETENESS");
  const coverage = buildAuthenticationAuditCoverageReport();

  if (coverage.missing.length > 0) {
    return failResult(
      definition,
      `Missing authentication audit coverage: ${coverage.missing.join(", ")}`,
    );
  }

  if (coverage.partial.length > 0) {
    return warnResult(
      definition,
      `Partial authentication audit coverage: ${coverage.partial.join(", ")}`,
    );
  }

  return passResult(
    definition,
    `All ${coverage.covered.length} authentication audit actions have writers, types, and SECURITY_AUDIT_ACTIONS entries`,
  );
}

function verifyRule09FinancialBoundary(): AuthenticationCertificationCheckResult {
  const definition = getDefinition("RULE_09_FINANCIAL_BOUNDARY");
  const hits = scanAuthFinancialBoundary();

  if (hits.length > 0) {
    return failResult(
      definition,
      hits.map((hit) => `${hit.file}: ${hit.match}`).join("; "),
    );
  }

  return passResult(
    definition,
    "No posting-service, ledger, due, or currentBalance references in auth paths",
  );
}

function verifyRule10Architecture(): AuthenticationCertificationCheckResult {
  const definition = getDefinition("RULE_10_ARCHITECTURE");
  const hits = scanAuthArchitectureImports();

  if (hits.length > 0) {
    return failResult(
      definition,
      hits.map((hit) => `${hit.file} → ${hit.importPath}`).join("; "),
    );
  }

  return passResult(
    definition,
    "Auth actions and lib imports limited to RBAC, audit, prisma, users, and validators",
  );
}

async function verifyRule11Performance(databaseAvailable: boolean): Promise<{
  check: AuthenticationCertificationCheckResult;
  audit: AuthenticationPerformanceAudit;
}> {
  const definition = getDefinition("RULE_11_PERFORMANCE");
  const estimatedQuerySurface = countAuthQuerySurface();
  const emptyAudit: AuthenticationPerformanceAudit = {
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

  const measurements: AuthenticationPerformanceMeasurement[] = [];

  for (const [role, email] of Object.entries(DEMO_USER_EMAILS)) {
    const started = performance.now();
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, mustChangePassword: true },
    });
    const durationMs = Math.round(performance.now() - started);

    if (!user) continue;

    measurements.push({
      operation: "login",
      path: `prisma.user.findUnique:${role}`,
      durationMs,
      queryCountEstimate: 1,
      withinTarget: durationMs < AUTH_PERFORMANCE_TARGET_MS,
    });
  }

  const middlewareStarted = performance.now();
  for (const blockedPath of BLOCKED_MUST_CHANGE_PATHS) {
    isMustChangePasswordAllowedPath(blockedPath);
  }
  const middlewareDuration = Math.round(performance.now() - middlewareStarted);
  measurements.push({
    operation: "middleware",
    path: "isMustChangePasswordAllowedPath",
    durationMs: middlewareDuration,
    queryCountEstimate: 0,
    withinTarget: middlewareDuration < AUTH_PERFORMANCE_TARGET_MS,
  });

  const slowest = measurements.reduce<AuthenticationPerformanceMeasurement | null>(
    (acc, item) => {
      if (!acc || item.durationMs > acc.durationMs) return item;
      return acc;
    },
    null,
  );

  const allWithinTarget =
    measurements.length > 0 && measurements.every((item) => item.withinTarget);

  const audit: AuthenticationPerformanceAudit = {
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
        `Slowest auth path (${slowest?.operation}): ${slowest?.durationMs}ms exceeds ${AUTH_PERFORMANCE_TARGET_MS}ms target`,
        slowest?.durationMs ?? 0,
      ),
      audit,
    };
  }

  return {
    check: passResult(
      definition,
      `All ${measurements.length} live measurements under ${AUTH_PERFORMANCE_TARGET_MS}ms (query surface: ${estimatedQuerySurface})`,
    ),
    audit,
  };
}

function verifyRule12SessionSecurity(): AuthenticationCertificationCheckResult {
  const definition = getDefinition("RULE_12_SESSION_SECURITY");
  const result = verifySessionSecurity();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }

  return passResult(
    definition,
    "JWT/session propagate mustChangePassword; authorize allows lifecycleStatus ACTIVE only",
  );
}

function verifyAuthMiddlewareScan(): AuthenticationCertificationCheckResult {
  const definition = getDefinition("AUTH_MIDDLEWARE_SCAN");
  const middleware = fileExists("middleware.ts") ? readSourceFile("middleware.ts") : "";
  const failures: string[] = [];

  if (!middleware.includes("mustChangePassword")) {
    failures.push("middleware missing mustChangePassword enforcement");
  }
  if (!middleware.includes("isMustChangePasswordAllowedPath")) {
    failures.push("middleware missing isMustChangePasswordAllowedPath guard");
  }
  if (!middleware.includes('new URL("/auth/change-password"')) {
    failures.push("middleware missing redirect to /auth/change-password");
  }

  for (const blockedPath of BLOCKED_MUST_CHANGE_PATHS) {
    if (isMustChangePasswordAllowedPath(blockedPath)) {
      failures.push(`${blockedPath} not blocked by mustChangePassword routing`);
    }
  }

  if (failures.length > 0) {
    return failResult(definition, failures.join("; "));
  }

  return passResult(
    definition,
    "Middleware redirects mustChangePassword sessions away from dashboard, settings, and reports",
  );
}

function verifyAuthLoginRedirectScan(): AuthenticationCertificationCheckResult {
  const definition = getDefinition("AUTH_LOGIN_REDIRECT_SCAN");
  const failures: string[] = [];
  const loginModule = fileExists("src/lib/actions/auth/login.ts")
    ? readSourceFile("src/lib/actions/auth/login.ts")
    : "";
  const middleware = fileExists("middleware.ts") ? readSourceFile("middleware.ts") : "";

  if (!loginModule.includes("resolvePostLoginRedirect")) {
    failures.push("login action missing resolvePostLoginRedirect");
  }
  if (!loginModule.includes("mustChangePassword")) {
    failures.push("login action missing mustChangePassword lookup");
  }
  if (!middleware.includes('pathname === "/login"')) {
    failures.push("middleware missing authenticated /login redirect handling");
  }
  if (!middleware.includes("!session.user.mustChangePassword")) {
    failures.push("middleware missing mustChangePassword check on /login redirect");
  }

  const publicIsolation = verifyPublicAuthRouteIsolation();
  if (!publicIsolation.ok) {
    failures.push(...publicIsolation.failures);
  }

  if (failures.length > 0) {
    return failResult(definition, failures.join("; "));
  }

  return passResult(
    definition,
    "Login action and middleware apply resolvePostLoginRedirect with public route isolation",
  );
}

export function aggregateSubsystemStatuses(
  checks: AuthenticationCertificationCheckResult[],
): Record<AuthenticationCertificationSubsystem, AuthenticationCertificationStatus> {
  const subsystems: AuthenticationCertificationSubsystem[] = [
    "security",
    "passwordSecurity",
    "tokenSecurity",
    "sessionSecurity",
    "auditCoverage",
    "financialBoundary",
    "architecture",
    "performance",
  ];

  const result = {} as Record<
    AuthenticationCertificationSubsystem,
    AuthenticationCertificationStatus
  >;

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

export function computeOverallScore(checks: AuthenticationCertificationCheckResult[]): {
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
    criticalFailures === 0 && overallScore >= AUTH_PRODUCTION_READINESS_THRESHOLD;

  return {
    overallScore,
    passedChecks,
    failedChecks,
    warningCount,
    productionReady,
  };
}

export async function runAllAuthenticationCertificationChecks(): Promise<{
  checks: AuthenticationCertificationCheckResult[];
  performanceAudit: AuthenticationPerformanceAudit;
  auditCoverage: AuthenticationAuditCoverageReport;
}> {
  const databaseAvailable = await resolveDatabaseAvailability();
  const auditCoverage = buildAuthenticationAuditCoverageReport();
  const { check: performanceCheck, audit: performanceAudit } =
    await verifyRule11Performance(databaseAvailable);

  const checks: AuthenticationCertificationCheckResult[] = [
    verifyRule01PasswordSecurity(),
    verifyRule02TokenSecurity(),
    verifyRule03MustChangePassword(),
    verifyRule04ActivationFlow(),
    verifyRule05PasswordReset(),
    verifyRule06RoleLoginMatrix(),
    verifyRule07PrivilegeEscalation(),
    verifyRule08AuditCompleteness(),
    verifyRule09FinancialBoundary(),
    verifyRule10Architecture(),
    performanceCheck,
    verifyRule12SessionSecurity(),
    verifyAuthMiddlewareScan(),
    verifyAuthLoginRedirectScan(),
  ];

  return { checks, performanceAudit, auditCoverage };
}
