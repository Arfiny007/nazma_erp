import { prisma } from "@/lib/prisma";

import { NotificationNotFoundError } from "./notification-errors";
import { queryNotificationById } from "./notification-query";
import type { NotificationRecord } from "./notification-types";

/**
 * Marks a notification as queued for delivery.
 * Sets `queuedAt` and leaves status PENDING for the worker to claim.
 */
export async function queueNotification(
  notificationId: string,
): Promise<NotificationRecord> {
  const existing = await queryNotificationById(notificationId);
  if (!existing) {
    throw new NotificationNotFoundError();
  }

  if (existing.status !== "PENDING" && existing.status !== "FAILED") {
    return existing;
  }

  const now = new Date();
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      queuedAt: existing.queuedAt ?? now,
      status: "PENDING",
    },
  });

  return (await queryNotificationById(notificationId))!;
}

export async function listPendingNotifications(
  limit = 50,
): Promise<NotificationRecord[]> {
  const now = new Date();
  const rows = await prisma.notification.findMany({
    where: {
      OR: [
        {
          status: "PENDING",
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
        {
          status: "FAILED",
          nextRetryAt: { not: null, lte: now },
        },
      ],
    },
    include: { attempts: { orderBy: { attemptedAt: "desc" } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return rows.map((row) => ({
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
  }));
}

export {
  claimNotificationBatch,
  markNotificationFailed,
  markNotificationProcessing,
  markNotificationSent,
  normalizeBatchSize,
} from "./worker/notification-batch";

export {
  getNotificationMetrics,
  processPendingNotifications,
  retryFailedNotifications,
} from "./worker/notification-worker";
