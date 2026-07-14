"use server";

import { revalidatePath } from "next/cache";

import { processPendingNotifications } from "@/lib/notifications/worker/notification-worker";
import { ForbiddenError, requirePermission } from "@/lib/rbac/guards";
import type { ActionResult } from "@/types/notification";

import { fail, ok } from "./helpers";

export interface ProcessQueueResultDTO {
  claimed: number;
  sent: number;
  failed: number;
  skipped: boolean;
  paused: boolean;
}

export async function processNotificationQueue(
  batchSize?: number,
): Promise<ActionResult<ProcessQueueResultDTO>> {
  try {
    const actor = await requirePermission("notifications:manage");
    const result = await processPendingNotifications(actor.id, batchSize);
    revalidatePath("/settings/notifications");
    return ok(result);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("FORBIDDEN", "rbac.noAccess");
    }
    return fail("INTERNAL_ERROR", "notifications.error.unexpected");
  }
}
