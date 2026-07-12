"use server";

import { requirePermission } from "@/lib/rbac/guards";
import { getManagerDashboard } from "@/lib/dashboard";
import type { ActionResult, DashboardPayloadDTO } from "@/types/dashboard";

import { fail, fromDashboardError, ok, toDashboardPayloadDTO } from "./helpers";

export async function getManagerDashboardAction(): Promise<
  ActionResult<DashboardPayloadDTO>
> {
  let user;
  try {
    user = await requirePermission("dashboard:view");
  } catch {
    return fail<DashboardPayloadDTO>("FORBIDDEN", "rbac.noAccess");
  }

  if (user.role !== "Manager") {
    return fail<DashboardPayloadDTO>("FORBIDDEN", "dashboard.error.wrongRole");
  }

  try {
    const payload = await getManagerDashboard(user.id);
    return ok(toDashboardPayloadDTO(payload));
  } catch (error) {
    return fromDashboardError(error);
  }
}
