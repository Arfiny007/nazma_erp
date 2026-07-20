"use server";

import { getAllowedTerritoryOptions } from "@/lib/reports/sr-performance";
import { requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import type { ActionResult, TerritoryOptionDTO } from "@/types/sr-performance";

import { fail, fromSrPerformanceError, ok } from "./helpers";

/**
 * Territory filter options within authenticated scope — PHASE_12A.
 */
export async function getSrPerformanceTerritoryOptions(): Promise<
  ActionResult<TerritoryOptionDTO[]>
> {
  let user;
  try {
    user = await requirePermission("reports:sr-performance:view");
  } catch {
    return fail<TerritoryOptionDTO[]>("FORBIDDEN", "rbac.noAccess");
  }

  const scope = await buildTerritoryScope(user.id);

  try {
    const options = await getAllowedTerritoryOptions(scope);
    return ok(options);
  } catch (error) {
    return fromSrPerformanceError(error);
  }
}
