"use server";

import { revalidatePath } from "next/cache";

import { setQueuePaused } from "@/lib/notifications/worker/notification-queue-config";
import { ForbiddenError, requirePermission } from "@/lib/rbac/guards";
import type { ActionResult } from "@/types/notification";

import { fail, ok } from "./helpers";

export async function setNotificationQueuePaused(
  paused: boolean,
): Promise<ActionResult<{ paused: boolean }>> {
  try {
    await requirePermission("notifications:manage");
    const config = await setQueuePaused(paused);
    revalidatePath("/settings/notifications");
    return ok({ paused: config.paused });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("FORBIDDEN", "rbac.noAccess");
    }
    return fail("INTERNAL_ERROR", "notifications.error.unexpected");
  }
}
