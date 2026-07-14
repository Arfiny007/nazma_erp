"use server";

import { getNotification as getNotificationRecord } from "@/lib/notifications";
import { ForbiddenError } from "@/lib/rbac/guards";
import { requirePermission } from "@/lib/rbac/guards";
import type { ActionResult, NotificationDTO } from "@/types/notification";

import { fail, fromDomainError, ok } from "./helpers";

export async function getNotification(
  notificationId: string,
): Promise<ActionResult<NotificationDTO>> {
  try {
    await requirePermission("notifications:view");
    if (!notificationId?.trim()) {
      return fail("VALIDATION_ERROR", "notifications.error.idRequired");
    }

    const data = await getNotificationRecord(notificationId.trim());
    return ok(data);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("FORBIDDEN", "rbac.noAccess");
    }
    return fromDomainError(error);
  }
}
