"use server";

import { revalidatePath } from "next/cache";

import { cancelNotification as cancelNotificationRecord } from "@/lib/notifications";
import { ForbiddenError } from "@/lib/rbac/guards";
import { requirePermission } from "@/lib/rbac/guards";
import type { ActionResult, NotificationDTO } from "@/types/notification";

import { fail, fromDomainError, ok } from "./helpers";

export async function cancelNotification(
  notificationId: string,
): Promise<ActionResult<NotificationDTO>> {
  try {
    const actor = await requirePermission("notifications:create");
    if (!notificationId?.trim()) {
      return fail("VALIDATION_ERROR", "notifications.error.idRequired");
    }

    const data = await cancelNotificationRecord(notificationId.trim(), actor.id);
    revalidatePath("/settings/notifications");
    return ok(data);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("FORBIDDEN", "rbac.noAccess");
    }
    return fromDomainError(error);
  }
}
