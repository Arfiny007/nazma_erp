"use server";

import { requirePermission } from "@/lib/rbac/guards";
import { resolveAnalyticsForRole } from "@/lib/dashboard/analytics";
import type { ActionResult } from "@/types/dashboard";
import type { AnalyticsPayloadDTO } from "@/types/analytics";

import { fail, fromDashboardError, ok } from "./helpers";

/**
 * Role-aware analytics entry point.
 */
export async function getDashboardAnalytics(): Promise<
  ActionResult<AnalyticsPayloadDTO>
> {
  let user;
  try {
    user = await requirePermission("dashboard:view");
  } catch {
    return fail<AnalyticsPayloadDTO>("FORBIDDEN", "rbac.noAccess");
  }

  try {
    const payload = await resolveAnalyticsForRole(user.id, user.role);
    return ok(payload);
  } catch (error) {
    return fromDashboardError(error);
  }
}
