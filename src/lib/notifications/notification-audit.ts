import type { Prisma } from "@prisma/client";

type AuditWriteClient = Pick<Prisma.TransactionClient, "auditLog">;

export const NOTIFICATION_AUDIT_ENTITY_TYPE = "Notification";

export type NotificationAuditAction =
  | "NOTIFICATION_CREATED"
  | "NOTIFICATION_SENT"
  | "NOTIFICATION_FAILED"
  | "NOTIFICATION_RETRIED"
  | "NOTIFICATION_CANCELLED"
  | "NOTIFICATION_PROCESSING_STARTED"
  | "NOTIFICATION_PROVIDER_SENT"
  | "NOTIFICATION_PROVIDER_FAILED"
  | "NOTIFICATION_QUEUE_PROCESSED"
  | "NOTIFICATION_BATCH_RETRIED";

export async function recordNotificationAudit(
  tx: AuditWriteClient,
  params: {
    actorId: string;
    notificationId: string;
    action: NotificationAuditAction;
    oldValue?: Prisma.InputJsonValue | null;
    newValue?: Prisma.InputJsonValue | null;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: params.actorId,
      entityType: NOTIFICATION_AUDIT_ENTITY_TYPE,
      entityId: params.notificationId,
      action: params.action,
      oldValue: params.oldValue ?? undefined,
      newValue: params.newValue ?? undefined,
    },
  });
}
