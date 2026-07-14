import { Prisma, type NotificationChannel } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  normalizeNotificationFilters,
  normalizeTemplateFilters,
} from "./notification-validation";
import type {
  NotificationRecord,
  NotificationSearchFilters,
  NotificationTemplateRecord,
  NotificationTemplateSearchFilters,
  PaginatedNotifications,
  PaginatedNotificationTemplates,
} from "./notification-types";

const notificationInclude = {
  attempts: {
    orderBy: { attemptedAt: "desc" as const },
  },
} as const;

type NotificationRow = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

type TemplateRow = Prisma.NotificationTemplateGetPayload<Record<string, never>>;

function toNotificationRecord(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    type: row.type,
    channel: row.channel,
    status: row.status,
    recipient: row.recipient,
    subject: row.subject,
    payload: row.payload as Record<string, unknown>,
    retryCount: row.retryCount,
    maxRetries: row.maxRetries,
    queuedAt: row.queuedAt?.toISOString() ?? null,
    processingStartedAt: row.processingStartedAt?.toISOString() ?? null,
    nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    provider: row.provider,
    providerMessageId: row.providerMessageId,
    sentAt: row.sentAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    attempts: row.attempts.map((attempt) => ({
      id: attempt.id,
      provider: attempt.provider,
      status: attempt.status,
      error: attempt.error,
      attemptedAt: attempt.attemptedAt.toISOString(),
    })),
  };
}

function toTemplateRecord(row: TemplateRow): NotificationTemplateRecord {
  return {
    id: row.id,
    key: row.key,
    channel: row.channel,
    locale: row.locale,
    subject: row.subject,
    body: row.body,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildNotificationWhere(
  filters: ReturnType<typeof normalizeNotificationFilters>,
): Prisma.NotificationWhereInput {
  const where: Prisma.NotificationWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.type) {
    where.type = filters.type;
  }
  if (filters.channel) {
    where.channel = filters.channel;
  }
  if (filters.recipient) {
    where.recipient = { contains: filters.recipient, mode: "insensitive" };
  }
  if (filters.search) {
    where.OR = [
      { recipient: { contains: filters.search, mode: "insensitive" } },
      { subject: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

function buildTemplateWhere(
  filters: ReturnType<typeof normalizeTemplateFilters>,
): Prisma.NotificationTemplateWhereInput {
  const where: Prisma.NotificationTemplateWhereInput = {
    isActive: true,
  };

  if (filters.key) {
    where.key = { contains: filters.key, mode: "insensitive" };
  }
  if (filters.locale) {
    where.locale = filters.locale;
  }
  if (filters.channel) {
    where.channel = filters.channel;
  }
  if (filters.search) {
    where.OR = [
      { key: { contains: filters.search, mode: "insensitive" } },
      { subject: { contains: filters.search, mode: "insensitive" } },
      { body: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function queryNotificationById(
  id: string,
): Promise<NotificationRecord | null> {
  const row = await prisma.notification.findUnique({
    where: { id },
    include: notificationInclude,
  });

  return row ? toNotificationRecord(row) : null;
}

export async function queryNotifications(
  filters: NotificationSearchFilters,
): Promise<PaginatedNotifications> {
  const normalized = normalizeNotificationFilters(filters);
  const where = buildNotificationWhere(normalized);
  const skip = (normalized.page - 1) * normalized.pageSize;

  const [total, rows] = await prisma.$transaction([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      include: notificationInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: normalized.pageSize,
    }),
  ]);

  return {
    records: rows.map(toNotificationRecord),
    total,
    page: normalized.page,
    pageSize: normalized.pageSize,
    totalPages: Math.max(1, Math.ceil(total / normalized.pageSize)),
  };
}

export async function queryTemplateByKey(
  key: string,
  locale: string,
  channel: NotificationChannel,
): Promise<NotificationTemplateRecord | null> {
  const row = await prisma.notificationTemplate.findUnique({
    where: {
      key_locale_channel: { key, locale, channel },
    },
  });

  return row ? toTemplateRecord(row) : null;
}

export async function queryTemplates(
  filters: NotificationTemplateSearchFilters,
): Promise<PaginatedNotificationTemplates> {
  const normalized = normalizeTemplateFilters(filters);
  const where = buildTemplateWhere(normalized);
  const skip = (normalized.page - 1) * normalized.pageSize;

  const [total, rows] = await prisma.$transaction([
    prisma.notificationTemplate.count({ where }),
    prisma.notificationTemplate.findMany({
      where,
      orderBy: [{ key: "asc" }, { locale: "asc" }],
      skip,
      take: normalized.pageSize,
    }),
  ]);

  return {
    records: rows.map(toTemplateRecord),
    total,
    page: normalized.page,
    pageSize: normalized.pageSize,
    totalPages: Math.max(1, Math.ceil(total / normalized.pageSize)),
  };
}
