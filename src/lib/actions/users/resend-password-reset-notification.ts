"use server";

import { revalidatePath } from "next/cache";

import {
  AuthNotificationResendForbiddenError,
  AuthNotificationUserNotEligibleError,
} from "@/lib/notifications/auth-notification-errors";
import { resendPasswordResetNotification } from "@/lib/notifications/auth-notifications";
import { getCurrentUser } from "@/lib/auth/helpers";
import { ForbiddenError } from "@/lib/rbac/guards";
import type { ActionResult, NotificationDTO } from "@/types/notification";

import { fail, fromDomainError, ok } from "../notifications/helpers";

export async function resendPasswordResetEmail(
  userId: string,
): Promise<ActionResult<NotificationDTO>> {
  try {
    const actor = await getCurrentUser();
    if (!actor) {
      return fail("FORBIDDEN", "rbac.noAccess");
    }
    const data = await resendPasswordResetNotification(actor, userId);
    revalidatePath("/settings/users");
    revalidatePath("/settings/notifications");
    return ok(data);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof AuthNotificationResendForbiddenError) {
      return fail("FORBIDDEN", "rbac.noAccess");
    }
    if (error instanceof AuthNotificationUserNotEligibleError) {
      return fail("VALIDATION_ERROR", "userManagement.error.resendResetNotEligible");
    }
    return fromDomainError(error);
  }
}
