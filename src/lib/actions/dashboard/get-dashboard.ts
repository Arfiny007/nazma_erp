"use server";

import { requirePermission } from "@/lib/rbac/guards";
import { resolveDashboardForRole } from "@/lib/dashboard";
import type { ActionResult, DashboardPayloadDTO } from "@/types/dashboard";

import { fail, fromDashboardError, ok, toDashboardPayloadDTO } from "./helpers";

/**
 * Role-aware dashboard entry point — resolves SR / Manager / Accounts / Admin.
 */
export async function getDashboard(): Promise<ActionResult<DashboardPayloadDTO>> {
  let user;
  try {
    user = await requirePermission("dashboard:view");
  } catch {
    return fail<DashboardPayloadDTO>("FORBIDDEN", "rbac.noAccess");
  }

  try {
    const payload = await resolveDashboardForRole(user.id, user.role);
    return ok(toDashboardPayloadDTO(payload));
  } catch (error) {
    return fromDashboardError(error);
  }
}
