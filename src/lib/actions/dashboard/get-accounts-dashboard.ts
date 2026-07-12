"use server";

import { requirePermission } from "@/lib/rbac/guards";
import { getAccountsDashboard } from "@/lib/dashboard";
import type { ActionResult, DashboardPayloadDTO } from "@/types/dashboard";

import { fail, fromDashboardError, ok, toDashboardPayloadDTO } from "./helpers";

export async function getAccountsDashboardAction(): Promise<
  ActionResult<DashboardPayloadDTO>
> {
  let user;
  try {
    user = await requirePermission("dashboard:view");
  } catch {
    return fail<DashboardPayloadDTO>("FORBIDDEN", "rbac.noAccess");
  }

  if (user.role !== "Accounts") {
    return fail<DashboardPayloadDTO>("FORBIDDEN", "dashboard.error.wrongRole");
  }

  try {
    const payload = await getAccountsDashboard(user.id);
    return ok(toDashboardPayloadDTO(payload));
  } catch (error) {
    return fromDashboardError(error);
  }
}
