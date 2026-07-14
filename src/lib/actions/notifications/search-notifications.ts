"use server";

import {
  searchNotifications as searchNotificationsRecords,
  searchTemplates as searchTemplatesRecords,
} from "@/lib/notifications";
import { ForbiddenError } from "@/lib/rbac/guards";
import { requirePermission } from "@/lib/rbac/guards";
import {
  notificationSearchSchema,
  notificationTemplateSearchSchema,
} from "@/lib/validators/notification.schema";
import type {
  ActionResult,
  NotificationListDTO,
  NotificationTemplateListDTO,
} from "@/types/notification";

import { fail, fromDomainError, fromZodError, ok } from "./helpers";

export async function searchNotifications(
  input: unknown,
): Promise<ActionResult<NotificationListDTO>> {
  try {
    await requirePermission("notifications:view");
    const parsed = notificationSearchSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const data = await searchNotificationsRecords(parsed.data);
    return ok(data);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("FORBIDDEN", "rbac.noAccess");
    }
    return fromDomainError(error);
  }
}

export async function searchNotificationTemplates(
  input: unknown,
): Promise<ActionResult<NotificationTemplateListDTO>> {
  try {
    await requirePermission("notifications:view");
    const parsed = notificationTemplateSearchSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const data = await searchTemplatesRecords(parsed.data);
    return ok(data);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("FORBIDDEN", "rbac.noAccess");
    }
    return fromDomainError(error);
  }
}
