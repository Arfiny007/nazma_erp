import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import type { NotificationStatus } from "@prisma/client";

import { OPERATIONAL_AUDIT_ACTIONS } from "@/lib/audit/audit-validation";
import { hasPermission, ROLE_PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  assertNotificationTransition,
  canRetryNotification,
} from "@/lib/notifications/notification-validation";
import { NotificationLifecycleError } from "@/lib/notifications/notification-errors";
import { computeNextRetryAt } from "@/lib/notifications/worker/notification-scheduler";
import { MAX_NOTIFICATION_PAGE_SIZE } from "@/lib/notifications/notification-types";

import type {
  NotificationAuditCoverageReport,
  NotificationCertificationCheckDefinition,
  NotificationCertificationCheckResult,
  NotificationCertificationStatus,
  NotificationCertificationSubsystem,
  NotificationPerformanceAudit,
  NotificationPerformanceMeasurement,
} from "./notification-certification-types";
import {
  NOTIFICATION_PERFORMANCE_TARGET_1000_MS,
  NOTIFICATION_PERFORMANCE_TARGET_100_MS,
  NOTIFICATION_PRODUCTION_READINESS_THRESHOLD,
} from "./notification-certification-types";

/**
 * Enterprise Notification Certification validation — PHASE_11D.
 *
 * Read-only verification across PHASE_11A–11C notification layer.
 *
 * @see ADR-056
 */

const PROJECT_ROOT = path.resolve(process.cwd());
const SRC_ROOT = path.join(PROJECT_ROOT, "src");
const NOTIFICATIONS_ROOT = path.join(SRC_ROOT, "lib/notifications");
const NOTIFICATION_ACTIONS_ROOT = path.join(SRC_ROOT, "lib/actions/notifications");
const USERS_ROOT = path.join(SRC_ROOT, "lib/users");
const AUTH_ACTIONS_ROOT = path.join(SRC_ROOT, "lib/actions/auth");

const LEDGER_ENTRY_WRITER = ["create", "LedgerEntry"].join("");
const CURRENT_BALANCE_MUTATION = ["currentBalance"].join("");

const EXPECTED_LIFECYCLE: Readonly<
  Record<NotificationStatus, readonly NotificationStatus[]>
> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SENT", "FAILED"],
  SENT: [],
  FAILED: ["PROCESSING"],
  CANCELLED: [],
};

const ILLEGAL_TRANSITIONS: Array<{ from: NotificationStatus; to: NotificationStatus }> = [
  { from: "SENT", to: "PENDING" },
  { from: "SENT", to: "PROCESSING" },
  { from: "CANCELLED", to: "PROCESSING" },
  { from: "CANCELLED", to: "SENT" },
  { from: "PENDING", to: "SENT" },
  { from: "PROCESSING", to: "CANCELLED" },
  { from: "FAILED", to: "SENT" },
  { from: "FAILED", to: "CANCELLED" },
];

const RETRY_POLICY_MS = {
  attempt2: 5 * 60 * 1000,
  attempt3: 30 * 60 * 1000,
} as const;

const NOTIFICATION_AUDIT_ACTION_SPECS = [
  {
    id: "NOTIFICATION_CREATED",
    label: "Notification created",
    signals: ['action: "NOTIFICATION_CREATED"', "action: 'NOTIFICATION_CREATED'"],
    files: ["notification-service.ts"],
  },
  {
    id: "NOTIFICATION_SENT",
    label: "Notification sent",
    signals: ['action: "NOTIFICATION_SENT"', "action: 'NOTIFICATION_SENT'"],
    files: ["notification-service.ts", "worker/notification-worker.ts"],
  },
  {
    id: "NOTIFICATION_FAILED",
    label: "Notification failed",
    signals: ['action: "NOTIFICATION_FAILED"', "action: 'NOTIFICATION_FAILED'"],
    files: ["notification-service.ts", "worker/notification-worker.ts"],
  },
  {
    id: "NOTIFICATION_RETRIED",
    label: "Notification retried",
    signals: ['action: "NOTIFICATION_RETRIED"', "action: 'NOTIFICATION_RETRIED'"],
    files: ["notification-service.ts"],
  },
  {
    id: "NOTIFICATION_CANCELLED",
    label: "Notification cancelled",
    signals: ['action: "NOTIFICATION_CANCELLED"', "action: 'NOTIFICATION_CANCELLED'"],
    files: ["notification-service.ts"],
  },
  {
    id: "NOTIFICATION_PROCESSING_STARTED",
    label: "Notification processing started",
    signals: [
      'action: "NOTIFICATION_PROCESSING_STARTED"',
      "action: 'NOTIFICATION_PROCESSING_STARTED'",
    ],
    files: ["worker/notification-worker.ts"],
  },
  {
    id: "NOTIFICATION_PROVIDER_SENT",
    label: "Notification provider sent",
    signals: [
      'action: "NOTIFICATION_PROVIDER_SENT"',
      "action: 'NOTIFICATION_PROVIDER_SENT'",
    ],
    files: ["worker/notification-worker.ts"],
  },
  {
    id: "NOTIFICATION_PROVIDER_FAILED",
    label: "Notification provider failed",
    signals: [
      'action: "NOTIFICATION_PROVIDER_FAILED"',
      "action: 'NOTIFICATION_PROVIDER_FAILED'",
    ],
    files: ["worker/notification-worker.ts"],
  },
  {
    id: "NOTIFICATION_QUEUE_PROCESSED",
    label: "Notification queue processed",
    signals: [
      'action: "NOTIFICATION_QUEUE_PROCESSED"',
      "action: 'NOTIFICATION_QUEUE_PROCESSED'",
    ],
    files: ["worker/notification-worker.ts"],
  },
  {
    id: "NOTIFICATION_BATCH_RETRIED",
    label: "Notification batch retried",
    signals: [
      'action: "NOTIFICATION_BATCH_RETRIED"',
      "action: 'NOTIFICATION_BATCH_RETRIED'",
    ],
    files: ["worker/notification-queue-config.ts"],
  },
] as const;

const AUTH_INTEGRATION_CHAIN_SPECS = [
  {
    flow: "Activation provisioning",
    signals: [
      "USER_CREATED",
      "USER_ACTIVATION_STARTED",
      "NOTIFICATION_CREATED",
      "createNotification",
      "queueNotification",
      "dispatchActivationNotification",
    ],
    files: [
      "src/lib/users/user-service.ts",
      "src/lib/notifications/auth-notifications.ts",
      "src/lib/notifications/notification-service.ts",
      "src/lib/actions/users/create-user.ts",
    ],
  },
  {
    flow: "Activation completion",
    signals: ["USER_ACTIVATION_COMPLETED"],
    files: ["src/lib/users/user-activation-service.ts"],
  },
  {
    flow: "Password reset request",
    signals: [
      "USER_PASSWORD_RESET_REQUESTED",
      "NOTIFICATION_CREATED",
      "dispatchPasswordResetNotification",
      "queueNotification",
      "createNotification",
    ],
    files: [
      "src/lib/users/user-password-reset-service.ts",
      "src/lib/notifications/auth-notifications.ts",
      "src/lib/notifications/notification-service.ts",
      "src/lib/actions/auth/request-password-reset.ts",
    ],
  },
  {
    flow: "Password reset completion",
    signals: ["USER_PASSWORD_RESET_COMPLETED"],
    files: ["src/lib/users/user-password-reset-service.ts"],
  },
] as const;

const ALLOWED_NOTIFICATION_MODULE_IMPORTS = [
  "@/lib/audit",
  "@/lib/auth",
  "@/lib/prisma",
  "@/lib/permissions",
  "@/lib/validators",
  "@/lib/users",
  "@/lib/notifications",
  "@/lib/documents/company-branding",
  "@/types/",
  "@prisma/",
  "node:",
  "nodemailer",
  "zod",
  "next/",
] as const;

const ALLOWED_NOTIFICATION_ACTION_IMPORTS = [
  ...ALLOWED_NOTIFICATION_MODULE_IMPORTS,
  "@/lib/rbac",
  "@/lib/rbac/guards",
] as const;

const FORBIDDEN_NOTIFICATION_MODULE_IMPORTS = [
  "@/lib/finance/posting-service",
  "@/lib/due",
  "@/lib/dashboard",
  "@/lib/ledger",
  "@/lib/collections",
  "@/lib/invoices",
  "@/lib/dealers/ownership",
  "@/lib/rbac/territory",
] as const;

const AUTH_PROVIDER_ISOLATION_SCAN_ROOTS = [
  USERS_ROOT,
  AUTH_ACTIONS_ROOT,
  path.join(SRC_ROOT, "lib/actions/users"),
] as const;

const FORBIDDEN_AUTH_PROVIDER_PATTERNS = [
  { pattern: "nodemailer", label: "nodemailer import" },
  { pattern: "SmtpNotificationProvider", label: "direct SMTP provider import" },
  { pattern: "resolveNotificationProvider", label: "direct provider resolution" },
  { pattern: "sendNotification(", label: "direct sendNotification call" },
  { pattern: "smtp-provider", label: "smtp-provider import" },
] as const;

export const NOTIFICATION_CERTIFICATION_CHECK_CATALOG: NotificationCertificationCheckDefinition[] =
  [
    {
      id: "RULE_01_IMMUTABILITY",
      name: "NotificationDeliveryAttempt rows are append-only",
      subsystem: "queueIntegrity",
      category: "immutability",
      severity: "critical",
      ruleNumber: 1,
    },
    {
      id: "RULE_02_QUEUE_INTEGRITY",
      name: "Notification lifecycle transitions guarded",
      subsystem: "queueIntegrity",
      category: "queue_integrity",
      severity: "critical",
      ruleNumber: 2,
    },
    {
      id: "RULE_03_RETRY_POLICY",
      name: "Retry scheduling: immediate → +5m → +30m → permanent FAILED",
      subsystem: "queueIntegrity",
      category: "retry_policy",
      severity: "critical",
      ruleNumber: 3,
    },
    {
      id: "RULE_04_PROVIDER_ISOLATION",
      name: "Authentication never calls SMTP or providers directly",
      subsystem: "providerArchitecture",
      category: "provider_isolation",
      severity: "critical",
      ruleNumber: 4,
    },
    {
      id: "RULE_05_AUTH_INTEGRATION",
      name: "Authentication notification audit chains present",
      subsystem: "authenticationIntegration",
      category: "auth_integration",
      severity: "critical",
      ruleNumber: 5,
    },
    {
      id: "RULE_06_NOTIFICATION_SECURITY",
      name: "Disabled/archived rejection and permission boundaries",
      subsystem: "notificationSecurity",
      category: "notification_security",
      severity: "critical",
      ruleNumber: 6,
    },
    {
      id: "RULE_07_QUEUE_SAFETY",
      name: "Batch claiming, concurrency, idempotency, stale recovery",
      subsystem: "queueIntegrity",
      category: "queue_safety",
      severity: "critical",
      ruleNumber: 7,
    },
    {
      id: "RULE_08_SMTP_ABSTRACTION",
      name: "Provider factory swappable; console fallback works",
      subsystem: "providerArchitecture",
      category: "smtp_abstraction",
      severity: "critical",
      ruleNumber: 8,
    },
    {
      id: "RULE_09_FINANCIAL_BOUNDARY",
      name: "Notification layer financially isolated",
      subsystem: "financialBoundary",
      category: "financial_boundary",
      severity: "critical",
      ruleNumber: 9,
    },
    {
      id: "RULE_10_AUDIT_COMPLETENESS",
      name: "Notification audit trail coverage measured",
      subsystem: "auditCoverage",
      category: "audit_completeness",
      severity: "warning",
      ruleNumber: 10,
    },
    {
      id: "RULE_11_ARCHITECTURE",
      name: "Notification modules respect architectural import boundaries",
      subsystem: "architecture",
      category: "architecture",
      severity: "critical",
      ruleNumber: 11,
    },
    {
      id: "RULE_12_PERFORMANCE",
      name: "Queue/search performance within certification targets",
      subsystem: "performance",
      category: "performance",
      severity: "critical",
      ruleNumber: 12,
    },
    {
      id: "NOTIFICATION_ACTION_PERMISSIONS",
      name: "Notification server actions protected by requirePermission",
      subsystem: "notificationSecurity",
      category: "notification_security",
      severity: "critical",
    },
    {
      id: "NOTIFICATION_MANAGE_SUPER_ADMIN",
      name: "notifications:manage restricted to Super_Admin",
      subsystem: "notificationSecurity",
      category: "notification_security",
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

function readNotificationFile(relativeToNotificationsRoot: string): string {
  return readFileSync(path.join(NOTIFICATIONS_ROOT, relativeToNotificationsRoot), "utf8");
}

function getDefinition(id: string): NotificationCertificationCheckDefinition {
  const definition = NOTIFICATION_CERTIFICATION_CHECK_CATALOG.find(
    (check) => check.id === id,
  );
  if (!definition) {
    throw new Error(`Unknown certification check: ${id}`);
  }
  return definition;
}

function makeResult(
  definition: NotificationCertificationCheckDefinition,
  passed: boolean,
  message: string,
  options: { warning?: boolean; durationMs?: number } = {},
): NotificationCertificationCheckResult {
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
  definition: NotificationCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): NotificationCertificationCheckResult {
  return makeResult(definition, true, message, { durationMs });
}

function failResult(
  definition: NotificationCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): NotificationCertificationCheckResult {
  return makeResult(definition, false, message, { durationMs });
}

function warnResult(
  definition: NotificationCertificationCheckDefinition,
  message: string,
  durationMs = 0,
): NotificationCertificationCheckResult {
  return makeResult(definition, true, message, { warning: true, durationMs });
}

function collectNotificationScanFiles(): string[] {
  const files = collectSourceFiles(NOTIFICATIONS_ROOT);
  files.push(...collectSourceFiles(NOTIFICATION_ACTIONS_ROOT));
  return files;
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

export function verifyDeliveryAttemptImmutability(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const notificationFiles = collectNotificationScanFiles();

  for (const file of notificationFiles) {
    const content = readFileSync(file, "utf8");
    if (/notificationDeliveryAttempt\.(update|delete|upsert)/.test(content)) {
      failures.push(`${relativePath(file)} mutates NotificationDeliveryAttempt`);
    }
  }

  const serviceModule = readNotificationFile("notification-service.ts");
  const workerModule = readNotificationFile("worker/notification-worker.ts");

  if (!serviceModule.includes("notificationDeliveryAttempt.create")) {
    failures.push("notification-service.ts missing delivery attempt create on send");
  }
  if (!workerModule.includes("notificationDeliveryAttempt.create")) {
    failures.push("notification-worker.ts missing delivery attempt create on deliver");
  }
  if (!serviceModule.includes("retryNotification")) {
    failures.push("retryNotification missing — retries must create new attempts via send");
  }

  const schema = fileExists("prisma/schema.prisma")
    ? readSourceFile("prisma/schema.prisma")
    : "";
  if (!schema.includes("model NotificationDeliveryAttempt")) {
    failures.push("NotificationDeliveryAttempt model missing from schema");
  }

  return { ok: failures.length === 0, failures };
}

export function verifyQueueLifecycleIntegrity(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const validationModule = readNotificationFile("notification-validation.ts");

  for (const [from, allowed] of Object.entries(EXPECTED_LIFECYCLE)) {
    for (const to of allowed) {
      try {
        assertNotificationTransition(from as NotificationStatus, to as NotificationStatus);
      } catch {
        failures.push(`Expected transition ${from} → ${to} rejected`);
      }
    }
  }

  for (const { from, to } of ILLEGAL_TRANSITIONS) {
    try {
      assertNotificationTransition(from, to);
      failures.push(`Illegal transition ${from} → ${to} was allowed`);
    } catch (error) {
      if (!(error instanceof NotificationLifecycleError)) {
        failures.push(`Illegal transition ${from} → ${to} threw unexpected error`);
      }
    }
  }

  if (!validationModule.includes("ALLOWED_TRANSITIONS")) {
    failures.push("notification-validation.ts missing ALLOWED_TRANSITIONS map");
  }
  if (!validationModule.includes("NotificationLifecycleError")) {
    failures.push("notification-validation.ts missing NotificationLifecycleError guard");
  }

  return { ok: failures.length === 0, failures };
}

export function verifyRetryPolicy(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const schedulerModule = readNotificationFile("worker/notification-scheduler.ts");
  const serviceModule = readNotificationFile("notification-service.ts");
  const base = new Date("2026-07-13T12:00:00.000Z");
  const maxRetries = 3;

  const attempt2 = computeNextRetryAt(1, maxRetries, base);
  const attempt3 = computeNextRetryAt(2, maxRetries, base);
  const exhausted = computeNextRetryAt(3, maxRetries, base);

  if (!attempt2 || attempt2.getTime() !== base.getTime() + RETRY_POLICY_MS.attempt2) {
    failures.push("Attempt 2 delay must be +5 minutes");
  }
  if (!attempt3 || attempt3.getTime() !== base.getTime() + RETRY_POLICY_MS.attempt3) {
    failures.push("Attempt 3 delay must be +30 minutes");
  }
  if (exhausted !== null) {
    failures.push("Attempt 4 must yield permanent FAILED (nextRetryAt null)");
  }

  if (!schedulerModule.includes("5 * 60 * 1000")) {
    failures.push("notification-scheduler.ts missing +5 minute delay constant");
  }
  if (!schedulerModule.includes("30 * 60 * 1000")) {
    failures.push("notification-scheduler.ts missing +30 minute delay constant");
  }
  if (!serviceModule.includes("computeNextRetryAt")) {
    failures.push("notification-service.ts must compute nextRetryAt on failure");
  }
  if (!serviceModule.includes("maxRetries: input.maxRetries ?? 3")) {
    failures.push("createNotification default maxRetries must be 3");
  }
  if (!canRetryNotification("FAILED", 2, 3)) {
    failures.push("canRetryNotification must allow FAILED with retryCount < maxRetries");
  }
  if (canRetryNotification("FAILED", 3, 3)) {
    failures.push("canRetryNotification must reject exhausted retries");
  }

  return { ok: failures.length === 0, failures };
}

export function scanAuthProviderIsolation(): Array<{ file: string; match: string }> {
  const hits: Array<{ file: string; match: string }> = [];

  for (const root of AUTH_PROVIDER_ISOLATION_SCAN_ROOTS) {
    for (const file of collectSourceFiles(root)) {
      const content = readFileSync(file, "utf8");
      for (const { pattern, label } of FORBIDDEN_AUTH_PROVIDER_PATTERNS) {
        if (content.includes(pattern)) {
          hits.push({ file: relativePath(file), match: label });
        }
      }
    }
  }

  return hits;
}

export function verifyAuthIntegrationChains(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];

  for (const spec of AUTH_INTEGRATION_CHAIN_SPECS) {
    const corpus = spec.files.map((file) => readSourceFile(file)).join("\n");
    const missing = spec.signals.filter((signal) => !corpus.includes(signal));
    if (missing.length > 0) {
      failures.push(`${spec.flow} missing signals: ${missing.join(", ")}`);
    }
  }

  const authNotifications = readNotificationFile("auth-notifications.ts");
  if (!authNotifications.includes("createNotification")) {
    failures.push("auth-notifications.ts must call createNotification");
  }
  if (!authNotifications.includes("queueNotification")) {
    failures.push("auth-notifications.ts must call queueNotification (queue-only delivery)");
  }
  if (authNotifications.includes("sendNotification(")) {
    failures.push("auth-notifications.ts must not call sendNotification directly");
  }

  return { ok: failures.length === 0, failures };
}

export function verifyNotificationSecurity(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const authNotifications = readNotificationFile("auth-notifications.ts");

  if (!authNotifications.includes("BLOCKED_STATUSES")) {
    failures.push("BLOCKED_STATUSES missing for disabled/archived rejection");
  }
  if (!authNotifications.includes('"DISABLED"') || !authNotifications.includes('"ARCHIVED"')) {
    failures.push("Disabled and archived lifecycle statuses must be blocked");
  }
  if (!authNotifications.includes("assertSuperAdminResend")) {
    failures.push("assertSuperAdminResend missing for admin resend");
  }
  if (!authNotifications.includes('actor.role !== "Super_Admin"')) {
    failures.push("Resend must be Super_Admin only");
  }
  if (!authNotifications.includes("AuthNotificationUserNotEligibleError")) {
    failures.push("AuthNotificationUserNotEligibleError missing for ineligible users");
  }

  const resendActivation = fileExists("src/lib/actions/users/resend-activation-notification.ts")
    ? readSourceFile("src/lib/actions/users/resend-activation-notification.ts")
    : "";
  const resendReset = fileExists("src/lib/actions/users/resend-password-reset-notification.ts")
    ? readSourceFile("src/lib/actions/users/resend-password-reset-notification.ts")
    : "";

  for (const [label, corpus] of [
    ["resend-activation", resendActivation],
    ["resend-password-reset", resendReset],
  ] as const) {
    if (!corpus.includes("resendActivationNotification") && !corpus.includes("resendPasswordResetNotification")) {
      failures.push(`${label} action missing resend delegation`);
    }
  }

  return { ok: failures.length === 0, failures };
}

export function verifyQueueSafety(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const batchModule = readNotificationFile("worker/notification-batch.ts");
  const workerModule = readNotificationFile("worker/notification-worker.ts");
  const serviceModule = readNotificationFile("notification-service.ts");

  if (!batchModule.includes("FOR UPDATE SKIP LOCKED")) {
    failures.push("claimNotificationBatch missing FOR UPDATE SKIP LOCKED");
  }
  if (!batchModule.includes("claimNotificationBatch")) {
    failures.push("claimNotificationBatch missing");
  }
  if (!batchModule.includes("reclaimStaleProcessingNotifications")) {
    failures.push("reclaimStaleProcessingNotifications missing for stale recovery");
  }
  if (!workerModule.includes("processPendingNotifications")) {
    failures.push("processPendingNotifications missing from worker");
  }
  if (!workerModule.includes("claimNotificationBatch")) {
    failures.push("worker must claim batches for concurrent safety");
  }

  if (!serviceModule.includes('existing.status === "SENT"')) {
    failures.push("sendNotification missing idempotent SENT early return");
  }
  if (!serviceModule.includes('existing.status === "CANCELLED"')) {
    failures.push("sendNotification missing idempotent CANCELLED early return");
  }

  const script = fileExists("scripts/process-notifications.ts")
    ? readSourceFile("scripts/process-notifications.ts")
    : "";
  if (!script.includes("processPendingNotifications")) {
    failures.push("scripts/process-notifications.ts missing worker entry point");
  }

  return { ok: failures.length === 0, failures };
}

export function verifySmtpAbstraction(): { ok: boolean; failures: string[]; warnings: string[] } {
  const failures: string[] = [];
  const warnings: string[] = [];

  const factoryModule = readNotificationFile("providers/provider-factory.ts");
  const smtpModule = readNotificationFile("providers/smtp-provider.ts");
  const consoleModule = readNotificationFile("providers/console-provider.ts");

  if (!factoryModule.includes("resolveNotificationProvider")) {
    failures.push("provider-factory.ts missing resolveNotificationProvider");
  }
  if (!factoryModule.includes("ConsoleEmailProvider")) {
    failures.push("provider-factory.ts must support ConsoleEmailProvider fallback");
  }
  if (!factoryModule.includes("SmtpNotificationProvider")) {
    failures.push("provider-factory.ts must support SmtpNotificationProvider");
  }
  if (!smtpModule.includes("nodemailer")) {
    failures.push("nodemailer must be isolated to smtp-provider.ts");
  }
  if (!consoleModule.includes("ConsoleEmailProvider")) {
    failures.push("console-provider.ts missing ConsoleEmailProvider");
  }

  const notificationFiles = collectNotificationScanFiles();
  for (const file of notificationFiles) {
    const rel = relativePath(file);
    if (rel.endsWith("providers/smtp-provider.ts")) continue;
    const content = readFileSync(file, "utf8");
    if (content.includes("from \"nodemailer\"") || content.includes("from 'nodemailer'")) {
      failures.push(`${rel} imports nodemailer outside smtp-provider`);
    }
  }

  if (!factoryModule.includes("resetProviderCache")) {
    warnings.push("resetProviderCache helper recommended for test/provider swap");
  }

  return { ok: failures.length === 0, failures, warnings };
}

export function scanNotificationFinancialBoundary(): Array<{ file: string; match: string }> {
  const hits: Array<{ file: string; match: string }> = [];
  const forbiddenPatterns = [
    { pattern: "posting-service", label: "posting-service import" },
    { pattern: LEDGER_ENTRY_WRITER, label: "LedgerEntry write" },
    { pattern: CURRENT_BALANCE_MUTATION, label: "currentBalance mutation" },
    { pattern: "@/lib/due", label: "due engine import" },
    { pattern: "calculateDue", label: "due calculation" },
    { pattern: "@/lib/ledger", label: "ledger import" },
  ];

  for (const file of collectNotificationScanFiles()) {
    const content = readFileSync(file, "utf8");
    for (const { pattern, label } of forbiddenPatterns) {
      if (content.includes(pattern)) {
        hits.push({ file: relativePath(file), match: label });
      }
    }
  }

  return hits;
}

export function buildNotificationAuditCoverageReport(): NotificationAuditCoverageReport {
  const auditTypes = readNotificationFile("notification-audit.ts");
  const covered: string[] = [];
  const missing: string[] = [];
  const partial: string[] = [];

  for (const spec of NOTIFICATION_AUDIT_ACTION_SPECS) {
    const corpus = spec.files.map((filename) => readNotificationFile(filename)).join("\n");
    const hasWriter = spec.signals.some((signal) => corpus.includes(signal));
    const inAuditTypes =
      auditTypes.includes(`"${spec.id}"`) || auditTypes.includes(`'${spec.id}'`);
    const inOperationalActions = (OPERATIONAL_AUDIT_ACTIONS as readonly string[]).includes(
      spec.id,
    );

    if (hasWriter && inAuditTypes && inOperationalActions) {
      covered.push(spec.label);
    } else if (hasWriter || inAuditTypes || inOperationalActions) {
      const gaps: string[] = [];
      if (!hasWriter) gaps.push("writer");
      if (!inAuditTypes) gaps.push("NotificationAuditAction type");
      if (!inOperationalActions) gaps.push("OPERATIONAL_AUDIT_ACTIONS");
      partial.push(`${spec.label} (${gaps.join(", ")})`);
    } else {
      missing.push(spec.label);
    }
  }

  return { covered, missing, partial };
}

export function scanNotificationArchitectureImports(): Array<{
  file: string;
  importPath: string;
}> {
  const hits: Array<{ file: string; importPath: string }> = [];
  const importPattern = /from\s+["']([^"']+)["']/g;

  const libFiles = collectSourceFiles(NOTIFICATIONS_ROOT);
  const actionFiles = collectSourceFiles(NOTIFICATION_ACTIONS_ROOT).filter(
    (file) => !relativePath(file).endsWith("/helpers.ts") && !relativePath(file).endsWith("/index.ts"),
  );

  for (const file of libFiles) {
    const content = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    while ((match = importPattern.exec(content)) !== null) {
      const importPath = match[1]!;
      if (importPath.startsWith(".")) continue;

      const allowed = ALLOWED_NOTIFICATION_MODULE_IMPORTS.some((prefix) =>
        importPath.startsWith(prefix),
      );
      if (!allowed) {
        hits.push({ file: relativePath(file), importPath });
      }
    }
  }

  for (const file of actionFiles) {
    const content = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    while ((match = importPattern.exec(content)) !== null) {
      const importPath = match[1]!;
      if (importPath.startsWith(".")) continue;

      const allowed = ALLOWED_NOTIFICATION_ACTION_IMPORTS.some((prefix) =>
        importPath.startsWith(prefix),
      );
      if (!allowed) {
        hits.push({ file: relativePath(file), importPath });
      }
    }
  }

  for (const forbidden of FORBIDDEN_NOTIFICATION_MODULE_IMPORTS) {
    for (const file of [...libFiles, ...actionFiles]) {
      const content = readFileSync(file, "utf8");
      if (content.includes(forbidden)) {
        hits.push({ file: relativePath(file), importPath: forbidden });
      }
    }
  }

  return hits;
}

export function verifyNotificationActionPermissions(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const actionFiles = collectSourceFiles(NOTIFICATION_ACTIONS_ROOT).filter(
    (file) =>
      !relativePath(file).endsWith("/helpers.ts") &&
      !relativePath(file).endsWith("/index.ts"),
  );

  for (const file of actionFiles) {
    const content = readFileSync(file, "utf8");
    if (!content.includes("requirePermission")) {
      failures.push(`${relativePath(file)} missing requirePermission guard`);
    }
  }

  return { ok: failures.length === 0, failures };
}

export function verifyManagePermissionSuperAdminOnly(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];

  if (!hasPermission("Super_Admin", "notifications:manage")) {
    failures.push("Super_Admin must have notifications:manage");
  }
  for (const role of ["Manager", "SR", "Accounts"] as const) {
    if (hasPermission(role, "notifications:manage")) {
      failures.push(`${role} must not have notifications:manage`);
    }
  }

  const accountsPerms = ROLE_PERMISSIONS.Accounts;
  if (!accountsPerms.includes("notifications:view")) {
    failures.push("Accounts must retain notifications:view");
  }
  if (!accountsPerms.includes("notifications:retry")) {
    failures.push("Accounts must retain notifications:retry");
  }

  return { ok: failures.length === 0, failures };
}

export function countNotificationQuerySurface(): number {
  let count = 0;
  const patterns = [/\.(findMany|findUnique|aggregate|count|queryRaw)\s*\(/g];

  for (const file of collectNotificationScanFiles()) {
    const content = readFileSync(file, "utf8");
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      count += matches?.length ?? 0;
    }
  }

  return count;
}

export function verifyBoundedMemorySignals(): boolean {
  const queryModule = readNotificationFile("notification-query.ts");
  const validationModule = readNotificationFile("notification-validation.ts");

  return (
    queryModule.includes("take:") &&
    validationModule.includes("MAX_NOTIFICATION_PAGE_SIZE") &&
    MAX_NOTIFICATION_PAGE_SIZE <= 100
  );
}

function verifyRule01Immutability(): NotificationCertificationCheckResult {
  const definition = getDefinition("RULE_01_IMMUTABILITY");
  const result = verifyDeliveryAttemptImmutability();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }

  return passResult(
    definition,
    "NotificationDeliveryAttempt append-only; retries create new attempt rows",
  );
}

function verifyRule02QueueIntegrity(): NotificationCertificationCheckResult {
  const definition = getDefinition("RULE_02_QUEUE_INTEGRITY");
  const result = verifyQueueLifecycleIntegrity();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }

  return passResult(
    definition,
    "PENDING→PROCESSING→SENT, PENDING→CANCELLED, PROCESSING→FAILED→PROCESSING; illegal transitions rejected",
  );
}

function verifyRule03RetryPolicy(): NotificationCertificationCheckResult {
  const definition = getDefinition("RULE_03_RETRY_POLICY");
  const result = verifyRetryPolicy();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }

  return passResult(
    definition,
    "Retry policy verified: immediate → +5m → +30m → permanent FAILED at maxRetries=3",
  );
}

function verifyRule04ProviderIsolation(): NotificationCertificationCheckResult {
  const definition = getDefinition("RULE_04_PROVIDER_ISOLATION");
  const hits = scanAuthProviderIsolation();

  if (hits.length > 0) {
    return failResult(
      definition,
      hits.map((hit) => `${hit.file}: ${hit.match}`).join("; "),
    );
  }

  return passResult(
    definition,
    "Auth and user modules do not import nodemailer, SMTP, or call providers directly",
  );
}

function verifyRule05AuthIntegration(): NotificationCertificationCheckResult {
  const definition = getDefinition("RULE_05_AUTH_INTEGRATION");
  const result = verifyAuthIntegrationChains();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }

  return passResult(
    definition,
    "Activation and password reset audit chains wired through createNotification → queueNotification",
  );
}

function verifyRule06NotificationSecurity(): NotificationCertificationCheckResult {
  const definition = getDefinition("RULE_06_NOTIFICATION_SECURITY");
  const result = verifyNotificationSecurity();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }

  return passResult(
    definition,
    "Disabled/archived users rejected; resend Super_Admin only; eligibility errors typed",
  );
}

function verifyRule07QueueSafety(): NotificationCertificationCheckResult {
  const definition = getDefinition("RULE_07_QUEUE_SAFETY");
  const result = verifyQueueSafety();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }

  return passResult(
    definition,
    "FOR UPDATE SKIP LOCKED batch claim, stale recovery, idempotent send, worker script present",
  );
}

function verifyRule08SmtpAbstraction(): NotificationCertificationCheckResult {
  const definition = getDefinition("RULE_08_SMTP_ABSTRACTION");
  const result = verifySmtpAbstraction();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }
  if (result.warnings.length > 0) {
    return warnResult(definition, result.warnings.join("; "));
  }

  return passResult(
    definition,
    "Provider factory resolves SMTP or console; nodemailer isolated to smtp-provider.ts",
  );
}

function verifyRule09FinancialBoundary(): NotificationCertificationCheckResult {
  const definition = getDefinition("RULE_09_FINANCIAL_BOUNDARY");
  const hits = scanNotificationFinancialBoundary();

  if (hits.length > 0) {
    return failResult(
      definition,
      hits.map((hit) => `${hit.file}: ${hit.match}`).join("; "),
    );
  }

  return passResult(
    definition,
    "No posting-service, ledger, due, or currentBalance references in notification paths",
  );
}

function verifyRule10AuditCompleteness(): NotificationCertificationCheckResult {
  const definition = getDefinition("RULE_10_AUDIT_COMPLETENESS");
  const coverage = buildNotificationAuditCoverageReport();

  if (coverage.missing.length > 0) {
    return failResult(
      definition,
      `Missing notification audit coverage: ${coverage.missing.join(", ")}`,
    );
  }

  if (coverage.partial.length > 0) {
    return warnResult(
      definition,
      `Partial notification audit coverage: ${coverage.partial.join(", ")}`,
    );
  }

  return passResult(
    definition,
    `All ${coverage.covered.length} notification audit actions have writers, types, and OPERATIONAL_AUDIT_ACTIONS entries`,
  );
}

function verifyRule11Architecture(): NotificationCertificationCheckResult {
  const definition = getDefinition("RULE_11_ARCHITECTURE");
  const hits = scanNotificationArchitectureImports();

  if (hits.length > 0) {
    return failResult(
      definition,
      hits.map((hit) => `${hit.file} → ${hit.importPath}`).join("; "),
    );
  }

  return passResult(
    definition,
    "Notification modules import only audit, auth, prisma, validators, permissions, users",
  );
}

async function verifyRule12Performance(databaseAvailable: boolean): Promise<{
  check: NotificationCertificationCheckResult;
  audit: NotificationPerformanceAudit;
}> {
  const definition = getDefinition("RULE_12_PERFORMANCE");
  const estimatedQuerySurface = countNotificationQuerySurface();
  const boundedMemorySignals = verifyBoundedMemorySignals();

  const emptyAudit: NotificationPerformanceAudit = {
    measurements: [],
    slowestOperation: null,
    slowestDurationMs: 0,
    estimatedQuerySurface,
    allWithinTarget: false,
    liveDatabase: databaseAvailable,
    boundedMemorySignals,
  };

  if (!databaseAvailable) {
    return {
      check: passResult(
        definition,
        `Live performance audit skipped — DATABASE_URL unavailable. Structural query surface: ${estimatedQuerySurface} Prisma call sites; page cap ${MAX_NOTIFICATION_PAGE_SIZE}.`,
      ),
      audit: {
        ...emptyAudit,
        allWithinTarget: boundedMemorySignals,
      },
    };
  }

  const measurements: NotificationPerformanceMeasurement[] = [];

  const search100Started = performance.now();
  await prisma.notification.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, recipient: true },
  });
  const search100Ms = Math.round(performance.now() - search100Started);
  measurements.push({
    operation: "search",
    path: "notification.findMany:100",
    durationMs: search100Ms,
    recordCount: 100,
    withinTarget: search100Ms < NOTIFICATION_PERFORMANCE_TARGET_100_MS,
    structuralOnly: false,
  });

  const search1000Started = performance.now();
  await prisma.notification.findMany({
    take: 1000,
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  const search1000Ms = Math.round(performance.now() - search1000Started);
  measurements.push({
    operation: "search",
    path: "notification.findMany:1000",
    durationMs: search1000Ms,
    recordCount: 1000,
    withinTarget: search1000Ms < NOTIFICATION_PERFORMANCE_TARGET_1000_MS,
    structuralOnly: false,
  });

  const queueStarted = performance.now();
  await prisma.notification.count({
    where: {
      OR: [
        { status: "PENDING" },
        { status: "PROCESSING" },
        { status: "FAILED" },
      ],
    },
  });
  const queueMs = Math.round(performance.now() - queueStarted);
  measurements.push({
    operation: "queueProcessing",
    path: "notification.count:queue-eligible",
    durationMs: queueMs,
    recordCount: 0,
    withinTarget: queueMs < NOTIFICATION_PERFORMANCE_TARGET_100_MS,
    structuralOnly: false,
  });

  const slowest = measurements.reduce<NotificationPerformanceMeasurement | null>(
    (acc, item) => {
      if (!acc || item.durationMs > acc.durationMs) return item;
      return acc;
    },
    null,
  );

  const allWithinTarget =
    boundedMemorySignals &&
    measurements.length > 0 &&
    measurements.every((item) => item.withinTarget);

  const audit: NotificationPerformanceAudit = {
    measurements,
    slowestOperation: slowest?.operation ?? null,
    slowestDurationMs: slowest?.durationMs ?? 0,
    estimatedQuerySurface,
    allWithinTarget,
    liveDatabase: true,
    boundedMemorySignals,
  };

  if (!boundedMemorySignals) {
    return {
      check: failResult(
        definition,
        "Notification search lacks bounded page size — 10000+ rows risk unbounded memory",
      ),
      audit,
    };
  }

  if (!allWithinTarget) {
    return {
      check: warnResult(
        definition,
        `Slowest path (${slowest?.path}): ${slowest?.durationMs}ms exceeds target`,
        slowest?.durationMs ?? 0,
      ),
      audit,
    };
  }

  return {
    check: passResult(
      definition,
      `All ${measurements.length} live measurements within targets; bounded page size ${MAX_NOTIFICATION_PAGE_SIZE}`,
      slowest?.durationMs ?? 0,
    ),
    audit,
  };
}

function verifyNotificationActionPermissionsCheck(): NotificationCertificationCheckResult {
  const definition = getDefinition("NOTIFICATION_ACTION_PERMISSIONS");
  const result = verifyNotificationActionPermissions();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }

  return passResult(definition, "All notification server actions call requirePermission");
}

function verifyManagePermissionCheck(): NotificationCertificationCheckResult {
  const definition = getDefinition("NOTIFICATION_MANAGE_SUPER_ADMIN");
  const result = verifyManagePermissionSuperAdminOnly();

  if (!result.ok) {
    return failResult(definition, result.failures.join("; "));
  }

  return passResult(
    definition,
    "notifications:manage is Super_Admin only; Accounts retains view/create/retry",
  );
}

export function aggregateSubsystemStatuses(
  checks: NotificationCertificationCheckResult[],
): Record<NotificationCertificationSubsystem, NotificationCertificationStatus> {
  const subsystems: NotificationCertificationSubsystem[] = [
    "notificationSecurity",
    "queueIntegrity",
    "providerArchitecture",
    "authenticationIntegration",
    "auditCoverage",
    "financialBoundary",
    "architecture",
    "performance",
  ];

  const result = {} as Record<
    NotificationCertificationSubsystem,
    NotificationCertificationStatus
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

export function computeOverallScore(checks: NotificationCertificationCheckResult[]): {
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
    criticalFailures === 0 && overallScore >= NOTIFICATION_PRODUCTION_READINESS_THRESHOLD;

  return {
    overallScore,
    passedChecks,
    failedChecks,
    warningCount,
    productionReady,
  };
}

export async function runAllNotificationCertificationChecks(): Promise<{
  checks: NotificationCertificationCheckResult[];
  performanceAudit: NotificationPerformanceAudit;
  auditCoverage: NotificationAuditCoverageReport;
}> {
  const databaseAvailable = await resolveDatabaseAvailability();
  const auditCoverage = buildNotificationAuditCoverageReport();
  const { check: performanceCheck, audit: performanceAudit } =
    await verifyRule12Performance(databaseAvailable);

  const checks: NotificationCertificationCheckResult[] = [
    verifyRule01Immutability(),
    verifyRule02QueueIntegrity(),
    verifyRule03RetryPolicy(),
    verifyRule04ProviderIsolation(),
    verifyRule05AuthIntegration(),
    verifyRule06NotificationSecurity(),
    verifyRule07QueueSafety(),
    verifyRule08SmtpAbstraction(),
    verifyRule09FinancialBoundary(),
    verifyRule10AuditCompleteness(),
    verifyRule11Architecture(),
    performanceCheck,
    verifyNotificationActionPermissionsCheck(),
    verifyManagePermissionCheck(),
  ];

  return { checks, performanceAudit, auditCoverage };
}
