"use server";

import { requirePermission } from "@/lib/rbac/guards";
import { resolveTerritoryMapForRole } from "@/lib/dashboard/maps";
import type { TerritoryMapFilters } from "@/lib/dashboard/maps";
import type { ActionResult } from "@/types/dashboard";
import type { TerritoryMapPayloadDTO } from "@/types/maps";

import { fail, fromDashboardError, ok } from "./helpers";

/**
 * Role-aware territory map entry point.
 */
export async function getTerritoryMap(
  filters?: Partial<TerritoryMapFilters>,
): Promise<ActionResult<TerritoryMapPayloadDTO>> {
  let user;
  try {
    user = await requirePermission("dashboard:view");
  } catch {
    return fail<TerritoryMapPayloadDTO>("FORBIDDEN", "rbac.noAccess");
  }

  try {
    const payload = await resolveTerritoryMapForRole(
      user.id,
      user.role,
      filters,
    );
    return ok(payload);
  } catch (error) {
    return fromDashboardError(error);
  }
}
