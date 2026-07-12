"use server";

import { requirePermission } from "@/lib/rbac/guards";
import { getSrAnalytics } from "@/lib/dashboard/analytics";
import type { ActionResult } from "@/types/dashboard";
import type { AnalyticsPayloadDTO } from "@/types/analytics";

import { fail, fromDashboardError, ok } from "./helpers";

export async function getSrAnalyticsAction(): Promise<
  ActionResult<AnalyticsPayloadDTO>
> {
  let user;
  try {
    user = await requirePermission("dashboard:view");
  } catch {
    return fail<AnalyticsPayloadDTO>("FORBIDDEN", "rbac.noAccess");
  }

  if (user.role !== "SR") {
    return fail<AnalyticsPayloadDTO>("FORBIDDEN", "dashboard.error.wrongRole");
  }

  try {
    const payload = await getSrAnalytics(user.id);
    return ok(payload);
  } catch (error) {
    return fromDashboardError(error);
  }
}
