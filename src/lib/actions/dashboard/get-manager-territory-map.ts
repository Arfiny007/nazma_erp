"use server";

import { requirePermission } from "@/lib/rbac/guards";
import { getManagerTerritoryMap } from "@/lib/dashboard/maps";
import type { TerritoryMapFilters } from "@/lib/dashboard/maps";
import type { ActionResult } from "@/types/dashboard";
import type { TerritoryMapPayloadDTO } from "@/types/maps";

import { fail, fromDashboardError, ok } from "./helpers";

export async function getManagerTerritoryMapAction(
  filters?: Partial<TerritoryMapFilters>,
): Promise<ActionResult<TerritoryMapPayloadDTO>> {
  let user;
  try {
    user = await requirePermission("dashboard:view");
  } catch {
    return fail<TerritoryMapPayloadDTO>("FORBIDDEN", "rbac.noAccess");
  }

  if (user.role !== "Manager") {
    return fail<TerritoryMapPayloadDTO>("FORBIDDEN", "dashboard.error.wrongRole");
  }

  try {
    const payload = await getManagerTerritoryMap(user.id, filters);
    return ok(payload);
  } catch (error) {
    return fromDashboardError(error);
  }
}
