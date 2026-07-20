"use server";

import {
  getSrPerformanceOverview as getSrPerformanceOverviewRead,
  toOverviewResultDTO,
} from "@/lib/reports/sr-performance";
import { requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import { getSrPerformanceOverviewSchema } from "@/lib/validators/sr-performance.schema";
import type {
  ActionResult,
  SrPerformanceOverviewResultDTO,
} from "@/types/sr-performance";

import { fail, fromSrPerformanceError, fromZodError, ok } from "./helpers";

/**
 * Global SR overview — PHASE_12A. Read-only.
 */
export async function getSrPerformanceOverview(
  input: unknown = {},
): Promise<ActionResult<SrPerformanceOverviewResultDTO>> {
  let user;
  try {
    user = await requirePermission("reports:sr-performance:view");
  } catch {
    return fail<SrPerformanceOverviewResultDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = getSrPerformanceOverviewSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const scope = await buildTerritoryScope(user.id);

  try {
    const result = await getSrPerformanceOverviewRead(parsed.data, scope);
    return ok(toOverviewResultDTO(result));
  } catch (error) {
    return fromSrPerformanceError(error);
  }
}
