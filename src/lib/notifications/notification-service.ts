import type { Prisma } from "@prisma/client";
import { NotificationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { recordNotificationAudit } from "./notification-audit";
import {
  NotificationLifecycleError,
  NotificationNotFoundError,
  NotificationRetryExhaustedError,
} from "./notification-errors";
import {
  queryNotificationById,
  queryNotifications,
} from "./notification-query";
import { resolveNotificationProvider } from "./notification-provider";
import { queueNotification } from "./notification-queue";
import { computeNextRetryAt } from "./worker/notification-scheduler";
import {
  assertNotificationTransition,
  assertRecipient,
  canRetryNotification,
} from "./notification-validation";
import type {
  CreateNotificationInput,
  NotificationRecord,
  NotificationSearchFilters,
  PaginatedNotifications,
} from "./notification-types";

function buildDeliveryBody(
  payload: Record<string, unknown>,
  subject: string | null,
): string {
  if (typeof payload.body === "string") {
    return payload.body;
  }
  return subject ?? JSON.stringify(payload);
}

export async function createNotification(
  input: CreateNotificationInput,
  actorId: string,
): Promise<NotificationRecord> {
  assertRecipient(input.recipient);

  const notificationId = await prisma.$transaction(async (tx) => {
    const created = await tx.notification.create({
      data: {
        type: input.type,
        channel: input.channel,
        status: NotificationStatus.PENDING,
        recipient: input.recipient.trim(),
        subject: input.subject ?? null,
        payload: input.payload as Prisma.InputJsonValue,
        maxRetries: input.maxRetries ?? 3,
      },
    });

    await recordNotificationAudit(tx, {
      actorId,
      notificationId: created.id,
      action: "NOTIFICATION_CREATED",
      newValue: {
        type: created.type,
        channel: created.channel,
        recipient: created.recipient,
        status: created.status,
      },
    });

    return created.id;
  });

  return (await queryNotificationById(notificationId))!;
}

export { queueNotification };

export async function sendNotification(
  notificationId: string,
  actorId: string,
): Promise<NotificationRecord> {
  const existing = await queryNotificationById(notificationId);
  if (!existing) {
    throw new NotificationNotFoundError();
  }

  if (existing.status === "SENT" || existing.status === "CANCELLED") {
    return existing;
  }

  if (
    existing.status !== "PENDING" &&
    existing.status !== "FAILED" &&
    existing.status !== "PROCESSING"
  ) {
    throw new NotificationLifecycleError(existing.status, "PROCESSING");
  }

  if (existing.status !== "PROCESSING") {
    assertNotificationTransition(existing.status, "PROCESSING");

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: "PROCESSING",
        processingStartedAt: new Date(),
      },
    });
  }

  const provider = resolveNotificationProvider(existing.channel);
  const body = buildDeliveryBody(existing.payload, existing.subject);

  const result = await provider.send({
    notificationId: existing.id,
    type: existing.type,
    channel: existing.channel,
    recipient: existing.recipient,
    subject: existing.subject,
    body,
    metadata: existing.payload,
  });

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.notificationDeliveryAttempt.create({
      data: {
        notificationId,
        provider: result.provider,
        status: result.success ? "SENT" : "FAILED",
        error: result.error ?? null,
      },
    });

    if (result.success) {
      assertNotificationTransition("PROCESSING", "SENT");
      await tx.notification.update({
        where: { id: notificationId },
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
        notificationId,
        action: "NOTIFICATION_SENT",
        oldValue: { status: "PROCESSING" },
        newValue: { status: "SENT", provider: result.provider },
      });
    } else {
      assertNotificationTransition("PROCESSING", "FAILED");
      const nextRetryCount = existing.retryCount + 1;
      const nextRetryAt = computeNextRetryAt(
        nextRetryCount,
        existing.maxRetries,
        now,
      );
      const isExhausted = nextRetryAt === null;

      await tx.notification.update({
        where: { id: notificationId },
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
        notificationId,
        action: "NOTIFICATION_FAILED",
        oldValue: { status: "PROCESSING" },
        newValue: {
          status: isExhausted ? "FAILED" : "PENDING",
          provider: result.provider,
          error: result.error,
          retryCount: nextRetryCount,
          nextRetryAt: nextRetryAt?.toISOString() ?? null,
        },
      });
    }
  });

  return (await queryNotificationById(notificationId))!;
}

export async function retryNotification(
  notificationId: string,
  actorId: string,
): Promise<NotificationRecord> {
  const existing = await queryNotificationById(notificationId);
  if (!existing) {
    throw new NotificationNotFoundError();
  }

  if (!canRetryNotification(existing.status, existing.retryCount, existing.maxRetries)) {
    throw new NotificationRetryExhaustedError();
  }

  assertNotificationTransition(existing.status, "PROCESSING");

  await prisma.$transaction(async (tx) => {
    await tx.notification.update({
      where: { id: notificationId },
      data: {
        status: "PROCESSING",
        processingStartedAt: new Date(),
        nextRetryAt: null,
      },
    });

    await recordNotificationAudit(tx, {
      actorId,
      notificationId,
      action: "NOTIFICATION_RETRIED",
      oldValue: { status: "FAILED", retryCount: existing.retryCount },
      newValue: { status: "PROCESSING", retryCount: existing.retryCount },
    });
  });

  return sendNotification(notificationId, actorId);
}

export async function cancelNotification(
  notificationId: string,
  actorId: string,
): Promise<NotificationRecord> {
  const existing = await queryNotificationById(notificationId);
  if (!existing) {
    throw new NotificationNotFoundError();
  }

  if (existing.status === "CANCELLED") {
    return existing;
  }

  assertNotificationTransition(existing.status, "CANCELLED");

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.notification.update({
      where: { id: notificationId },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
      },
    });

    await recordNotificationAudit(tx, {
      actorId,
      notificationId,
      action: "NOTIFICATION_CANCELLED",
      oldValue: { status: existing.status },
      newValue: { status: "CANCELLED" },
    });
  });

  return (await queryNotificationById(notificationId))!;
}

export async function getNotification(
  notificationId: string,
): Promise<NotificationRecord> {
  const record = await queryNotificationById(notificationId);
  if (!record) {
    throw new NotificationNotFoundError();
  }
  return record;
}

export async function searchNotifications(
  filters: NotificationSearchFilters,
): Promise<PaginatedNotifications> {
  return queryNotifications(filters);
}
