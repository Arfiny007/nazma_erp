"use server";

import { getNotificationMetrics } from "@/lib/notifications/worker/notification-worker";
import { ForbiddenError, requirePermission } from "@/lib/rbac/guards";
import type { ActionResult } from "@/types/notification";

import { fail, ok } from "./helpers";

export type NotificationMetricsDTO = Awaited<
  ReturnType<typeof getNotificationMetrics>
>;

export async function getNotificationMetricsAction(): Promise<
  ActionResult<NotificationMetricsDTO>
> {
  try {
    await requirePermission("notifications:view");
    const metrics = await getNotificationMetrics();
    return ok(metrics);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("FORBIDDEN", "rbac.noAccess");
    }
    return fail("INTERNAL_ERROR", "notifications.error.unexpected");
  }
}
