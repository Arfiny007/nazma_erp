"use server";

import { revalidatePath } from "next/cache";

import { retryFailedNotifications } from "@/lib/notifications/worker/notification-worker";
import { ForbiddenError, requirePermission } from "@/lib/rbac/guards";
import type { ActionResult } from "@/types/notification";

import { fail, ok } from "./helpers";

export async function retryFailedNotificationsAction(
  limit?: number,
): Promise<ActionResult<{ scheduled: number }>> {
  try {
    const actor = await requirePermission("notifications:manage");
    const result = await retryFailedNotifications(actor.id, limit);
    revalidatePath("/settings/notifications");
    return ok(result);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("FORBIDDEN", "rbac.noAccess");
    }
    return fail("INTERNAL_ERROR", "notifications.error.unexpected");
  }
}
