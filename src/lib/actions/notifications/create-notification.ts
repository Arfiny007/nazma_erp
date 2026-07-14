"use server";

import { revalidatePath } from "next/cache";

import { createNotification as createNotificationRecord } from "@/lib/notifications";
import { ForbiddenError } from "@/lib/rbac/guards";
import { requirePermission } from "@/lib/rbac/guards";
import { createNotificationSchema } from "@/lib/validators/notification.schema";
import type { ActionResult, NotificationDTO } from "@/types/notification";

import { fail, fromDomainError, fromZodError, ok } from "./helpers";

export async function createNotification(
  input: unknown,
): Promise<ActionResult<NotificationDTO>> {
  try {
    const actor = await requirePermission("notifications:create");
    const parsed = createNotificationSchema.safeParse(input);
    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const data = await createNotificationRecord(parsed.data, actor.id);
    revalidatePath("/settings/notifications");
    return ok(data);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("FORBIDDEN", "rbac.noAccess");
    }
    return fromDomainError(error);
  }
}
