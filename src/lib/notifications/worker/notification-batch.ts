import type { NotificationChannel, NotificationStatus, NotificationType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { isStaleProcessing } from "./notification-scheduler";

export const DEFAULT_BATCH_SIZE = 25;
export const MAX_BATCH_SIZE = 100;

export function normalizeBatchSize(batchSize?: number): number {
  if (!Number.isFinite(batchSize) || (batchSize ?? 0) <= 0) {
    return DEFAULT_BATCH_SIZE;
  }
  return Math.min(batchSize as number, MAX_BATCH_SIZE);
}

export interface ClaimedNotification {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  recipient: string;
  subject: string | null;
  payload: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
}

function toClaimedNotification(row: {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  recipient: string;
  subject: string | null;
  payload: unknown;
  retryCount: number;
  maxRetries: number;
}): ClaimedNotification {
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
  };
}

export async function reclaimStaleProcessingNotifications(): Promise<number> {
  const threshold = new Date(Date.now() - 15 * 60 * 1000);

  const result = await prisma.notification.updateMany({
    where: {
      status: "PROCESSING",
      OR: [
        { processingStartedAt: { lt: threshold } },
        { processingStartedAt: null },
      ],
    },
    data: {
      status: "PENDING",
      processingStartedAt: null,
    },
  });

  return result.count;
}

export async function claimNotificationBatch(
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<ClaimedNotification[]> {
  const limit = normalizeBatchSize(batchSize);
  const now = new Date();

  await reclaimStaleProcessingNotifications();

  const claimed = await prisma.$transaction(async (tx) => {
    const eligible = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Notification"
      WHERE (
        (status = 'PENDING' AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= ${now}))
        OR (status = 'FAILED' AND "nextRetryAt" IS NOT NULL AND "nextRetryAt" <= ${now})
      )
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    if (eligible.length === 0) {
      return [];
    }

    const ids = eligible.map((row) => row.id);

    await tx.notification.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "PROCESSING",
        processingStartedAt: now,
      },
    });

    const rows = await tx.notification.findMany({
      where: { id: { in: ids } },
    });

    return rows.map(toClaimedNotification);
  });

  return claimed;
}

export async function markNotificationProcessing(
  notificationId: string,
): Promise<void> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: "PROCESSING",
      processingStartedAt: new Date(),
    },
  });
}

export async function markNotificationSent(
  notificationId: string,
  params: {
    provider: string;
    providerMessageId?: string | null;
  },
): Promise<void> {
  const now = new Date();
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: "SENT",
      sentAt: now,
      failedAt: null,
      lastAttemptAt: now,
      processingStartedAt: null,
      nextRetryAt: null,
      provider: params.provider,
      providerMessageId: params.providerMessageId ?? null,
    },
  });
}

export async function markNotificationFailed(
  notificationId: string,
  params: {
    retryCount: number;
    nextRetryAt: Date | null;
    provider?: string | null;
  },
): Promise<void> {
  const now = new Date();
  const isExhausted = params.nextRetryAt === null;

  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: isExhausted ? "FAILED" : "PENDING",
      failedAt: now,
      lastAttemptAt: now,
      processingStartedAt: null,
      retryCount: params.retryCount,
      nextRetryAt: params.nextRetryAt,
      provider: params.provider ?? null,
    },
  });
}

export { isStaleProcessing };
