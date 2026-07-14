import type { NotificationChannel } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { recordNotificationAudit } from "../notification-audit";
import { assertNotificationTransition } from "../notification-validation";
import { resolveNotificationProvider } from "../providers/provider-factory";
import type { NotificationDeliveryResult } from "../notification-types";
import {
  claimNotificationBatch,
  normalizeBatchSize,
  type ClaimedNotification,
} from "./notification-batch";
import {
  getQueueConfig,
  isQueuePaused,
  queryAverageDeliveryTimeMs,
  queryQueueMetrics,
  recordQueueProcessedAt,
  scheduleFailedForRetry,
  setQueuePaused,
  recordBatchRetriedAudit,
} from "./notification-queue-config";
import { computeNextRetryAt } from "./notification-scheduler";

export interface ProcessQueueResult {
  claimed: number;
  sent: number;
  failed: number;
  skipped: boolean;
  paused: boolean;
}

export interface NotificationMetricsSnapshot {
  queue: Awaited<ReturnType<typeof queryQueueMetrics>>;
  provider: Awaited<ReturnType<typeof import("../providers/provider-factory").getEmailProviderHealth>>;
  lastProcessedAt: string | null;
  averageDeliveryTimeMs: number | null;
  paused: boolean;
}

function buildDeliveryBody(
  payload: Record<string, unknown>,
  subject: string | null,
): string {
  if (typeof payload.body === "string") {
    return payload.body;
  }
  return subject ?? JSON.stringify(payload);
}

async function deliverClaimedNotification(
  notification: ClaimedNotification,
  actorId: string,
): Promise<"sent" | "failed"> {
  const provider = resolveNotificationProvider(
    notification.channel as NotificationChannel,
  );
  const body = buildDeliveryBody(notification.payload, notification.subject);

  await prisma.$transaction(async (tx) => {
    await recordNotificationAudit(tx, {
      actorId,
      notificationId: notification.id,
      action: "NOTIFICATION_PROCESSING_STARTED",
      oldValue: { status: notification.status },
      newValue: { status: "PROCESSING" },
    });
  });

  const result: NotificationDeliveryResult = await provider.send({
    notificationId: notification.id,
    type: notification.type,
    channel: notification.channel,
    recipient: notification.recipient,
    subject: notification.subject,
    body,
    metadata: notification.payload,
  });

  const now = new Date();

  if (result.success) {
    await prisma.$transaction(async (tx) => {
      await tx.notificationDeliveryAttempt.create({
        data: {
          notificationId: notification.id,
          provider: result.provider,
          status: "SENT",
          error: null,
        },
      });

      assertNotificationTransition("PROCESSING", "SENT");
      await tx.notification.update({
        where: { id: notification.id },
        data: {
          status: "SENT",
          sentAt: now,
          failedAt: null,
          lastAttemptAt: now,
          processingStartedAt: null,
          nextRetryAt: null,
          provider: result.provider,
          providerMessageId: result.messageId ?? null,
        },
      });

      await recordNotificationAudit(tx, {
        actorId,
        notificationId: notification.id,
        action: "NOTIFICATION_PROVIDER_SENT",
        oldValue: { status: "PROCESSING" },
        newValue: {
          status: "SENT",
          provider: result.provider,
          messageId: result.messageId ?? null,
        },
      });

      await recordNotificationAudit(tx, {
        actorId,
        notificationId: notification.id,
        action: "NOTIFICATION_SENT",
        oldValue: { status: "PROCESSING" },
        newValue: { status: "SENT", provider: result.provider },
      });
    });
    return "sent";
  }

  const nextRetryCount = notification.retryCount + 1;
  const nextRetryAt = computeNextRetryAt(
    nextRetryCount,
    notification.maxRetries,
    now,
  );
  const isExhausted = nextRetryAt === null;

  await prisma.$transaction(async (tx) => {
    await tx.notificationDeliveryAttempt.create({
      data: {
        notificationId: notification.id,
        provider: result.provider,
        status: "FAILED",
        error: result.error ?? "Delivery failed",
      },
    });

    assertNotificationTransition("PROCESSING", "FAILED");
    await tx.notification.update({
      where: { id: notification.id },
      data: {
        status: isExhausted ? "FAILED" : "PENDING",
        failedAt: now,
        lastAttemptAt: now,
        processingStartedAt: null,
        retryCount: nextRetryCount,
        nextRetryAt,
        provider: result.provider,
      },
    });

    await recordNotificationAudit(tx, {
      actorId,
      notificationId: notification.id,
      action: "NOTIFICATION_PROVIDER_FAILED",
      oldValue: { status: "PROCESSING" },
      newValue: {
        status: isExhausted ? "FAILED" : "PENDING",
        provider: result.provider,
        error: result.error,
        retryCount: nextRetryCount,
        nextRetryAt: nextRetryAt?.toISOString() ?? null,
      },
    });

    await recordNotificationAudit(tx, {
      actorId,
      notificationId: notification.id,
      action: "NOTIFICATION_FAILED",
      oldValue: { status: "PROCESSING" },
      newValue: {
        status: isExhausted ? "FAILED" : "PENDING",
        provider: result.provider,
        error: result.error,
        retryCount: nextRetryCount,
      },
    });
  });

  return "failed";
}

export async function processPendingNotifications(
  actorId: string,
  batchSize?: number,
): Promise<ProcessQueueResult> {
  const paused = await isQueuePaused();
  if (paused) {
    return {
      claimed: 0,
      sent: 0,
      failed: 0,
      skipped: true,
      paused: true,
    };
  }

  const batch = await claimNotificationBatch(normalizeBatchSize(batchSize));
  if (batch.length === 0) {
    return {
      claimed: 0,
      sent: 0,
      failed: 0,
      skipped: false,
      paused: false,
    };
  }

  let sent = 0;
  let failed = 0;

  for (const notification of batch) {
    const outcome = await deliverClaimedNotification(notification, actorId);
    if (outcome === "sent") {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  const processedAt = new Date();
  await recordQueueProcessedAt(processedAt);

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        userId: actorId,
        entityType: "NotificationQueue",
        entityId: "default",
        action: "NOTIFICATION_QUEUE_PROCESSED",
        newValue: {
          claimed: batch.length,
          sent,
          failed,
          processedAt: processedAt.toISOString(),
        },
      },
    });
  });

  return {
    claimed: batch.length,
    sent,
    failed,
    skipped: false,
    paused: false,
  };
}

export async function retryFailedNotifications(
  actorId: string,
  limit = 100,
): Promise<{ scheduled: number }> {
  const scheduled = await scheduleFailedForRetry(limit);

  if (scheduled > 0) {
    await prisma.$transaction(async (tx) => {
      await recordBatchRetriedAudit(tx, { actorId, count: scheduled });
    });
  }

  return { scheduled };
}

export async function getNotificationMetrics(): Promise<NotificationMetricsSnapshot> {
  const { getEmailProviderHealth } = await import("../providers/provider-factory");
  const [queue, config, averageDeliveryTimeMs, provider] = await Promise.all([
    queryQueueMetrics(),
    getQueueConfig(),
    queryAverageDeliveryTimeMs(),
    getEmailProviderHealth(),
  ]);

  return {
    queue,
    provider,
    lastProcessedAt: config.lastProcessedAt,
    averageDeliveryTimeMs,
    paused: config.paused,
  };
}

export {
  claimNotificationBatch,
  getQueueConfig,
  isQueuePaused,
  normalizeBatchSize,
  queryQueueMetrics,
  setQueuePaused,
};

export type { ClaimedNotification };
