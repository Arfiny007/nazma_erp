import type { Prisma } from "@prisma/client";

type AuditWriteClient = Pick<Prisma.TransactionClient, "auditLog">;

export const USER_AUDIT_ENTITY_TYPE = "User";

export type UserAuditAction =
  | "USER_CREATED"
  | "USER_ACTIVATED"
  | "USER_DEACTIVATED"
  | "USER_ROLE_CHANGED"
  | "USER_UPDATED"
  | "USER_PASSWORD_CHANGED"
  | "USER_PASSWORD_RESET_REQUESTED"
  | "USER_PASSWORD_RESET_COMPLETED"
  | "USER_ACTIVATION_STARTED"
  | "USER_ACTIVATION_COMPLETED";

export async function recordUserAudit(
  tx: AuditWriteClient,
  params: {
    actorId: string;
    targetUserId: string;
    action: UserAuditAction;
    oldValue?: Prisma.InputJsonValue | null;
    newValue?: Prisma.InputJsonValue | null;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: params.actorId,
      entityType: USER_AUDIT_ENTITY_TYPE,
      entityId: params.targetUserId,
      action: params.action,
      oldValue: params.oldValue ?? undefined,
      newValue: params.newValue ?? undefined,
    },
  });
}
