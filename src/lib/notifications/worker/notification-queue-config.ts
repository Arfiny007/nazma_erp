import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { computeNextRetryAt } from "./notification-scheduler";

const QUEUE_CONFIG_ID = "default";

export interface NotificationQueueConfigRecord {
  paused: boolean;
  lastProcessedAt: string | null;
  updatedAt: string;
}

export async function ensureQueueConfig(): Promise<void> {
  await prisma.notificationQueueConfig.upsert({
    where: { id: QUEUE_CONFIG_ID },
    create: { id: QUEUE_CONFIG_ID, paused: false },
    update: {},
  });
}

export async function getQueueConfig(): Promise<NotificationQueueConfigRecord> {
  await ensureQueueConfig();
  const config = await prisma.notificationQueueConfig.findUniqueOrThrow({
    where: { id: QUEUE_CONFIG_ID },
  });

  return {
    paused: config.paused,
    lastProcessedAt: config.lastProcessedAt?.toISOString() ?? null,
    updatedAt: config.updatedAt.toISOString(),
  };
}

export async function isQueuePaused(): Promise<boolean> {
  const config = await getQueueConfig();
  return config.paused;
}

export async function setQueuePaused(
  paused: boolean,
): Promise<NotificationQueueConfigRecord> {
  await ensureQueueConfig();
  const updated = await prisma.notificationQueueConfig.update({
    where: { id: QUEUE_CONFIG_ID },
    data: { paused },
  });

  return {
    paused: updated.paused,
    lastProcessedAt: updated.lastProcessedAt?.toISOString() ?? null,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function recordQueueProcessedAt(
  processedAt: Date = new Date(),
): Promise<void> {
  await ensureQueueConfig();
  await prisma.notificationQueueConfig.update({
    where: { id: QUEUE_CONFIG_ID },
    data: { lastProcessedAt: processedAt },
  });
}

export interface NotificationQueueMetrics {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  retryScheduled: number;
}

export async function queryQueueMetrics(): Promise<NotificationQueueMetrics> {
  const now = new Date();

  const [statusGroups, retryScheduled] = await Promise.all([
    prisma.notification.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.notification.count({
      where: {
        OR: [
          {
            status: "FAILED",
            nextRetryAt: { not: null, gt: now },
          },
          {
            status: "PENDING",
            nextRetryAt: { not: null, gt: now },
          },
        ],
      },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const group of statusGroups) {
    counts[group.status] = group._count._all;
  }

  return {
    pending: counts.PENDING ?? 0,
    processing: counts.PROCESSING ?? 0,
    sent: counts.SENT ?? 0,
    failed: counts.FAILED ?? 0,
    retryScheduled,
  };
}

export async function queryAverageDeliveryTimeMs(
  sampleSize = 100,
): Promise<number | null> {
  const rows = await prisma.$queryRaw<Array<{ avg_ms: number | null }>>`
    SELECT AVG(EXTRACT(EPOCH FROM ("sentAt" - "createdAt")) * 1000) AS avg_ms
    FROM (
      SELECT "sentAt", "createdAt"
      FROM "Notification"
      WHERE status = 'SENT' AND "sentAt" IS NOT NULL
      ORDER BY "sentAt" DESC
      LIMIT ${sampleSize}
    ) recent
  `;

  const avg = rows[0]?.avg_ms;
  return avg !== null && avg !== undefined && Number.isFinite(avg) ? avg : null;
}

export async function scheduleFailedForRetry(limit = 100): Promise<number> {
  const now = new Date();

  const eligible = await prisma.notification.findMany({
    where: {
      status: "FAILED",
      nextRetryAt: null,
    },
    select: {
      id: true,
      retryCount: true,
      maxRetries: true,
    },
    take: limit,
    orderBy: { failedAt: "asc" },
  });

  let scheduled = 0;
  for (const row of eligible) {
    if (row.retryCount >= row.maxRetries) {
      continue;
    }
    const nextRetryAt = computeNextRetryAt(row.retryCount, row.maxRetries, now);
    if (!nextRetryAt) {
      continue;
    }
    await prisma.notification.update({
      where: { id: row.id },
      data: {
        status: "PENDING",
        nextRetryAt,
      },
    });
    scheduled += 1;
  }

  return scheduled;
}

export async function recordBatchRetriedAudit(
  tx: Prisma.TransactionClient,
  params: {
    actorId: string;
    count: number;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: params.actorId,
      entityType: "NotificationQueue",
      entityId: QUEUE_CONFIG_ID,
      action: "NOTIFICATION_BATCH_RETRIED",
      newValue: { count: params.count },
    },
  });
}
