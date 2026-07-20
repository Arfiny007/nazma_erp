"use server";

import {
  getSrPerformancePrintPayload as getSrPerformancePrintPayloadRead,
  toPrintPayloadDTO,
} from "@/lib/reports/sr-performance";
import { requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import { getSrPerformancePrintPayloadSchema } from "@/lib/validators/sr-performance.schema";
import type {
  ActionResult,
  SrPerformancePrintPayloadDTO,
} from "@/types/sr-performance";

import { fail, fromSrPerformanceError, fromZodError, ok } from "./helpers";

/**
 * Full print payload (unpaginated, capped) — PHASE_12A. Read-only.
 */
export async function getSrPerformancePrintPayload(
  input: unknown = {},
): Promise<ActionResult<SrPerformancePrintPayloadDTO>> {
  let user;
  try {
    user = await requirePermission("reports:sr-performance:view");
  } catch {
    return fail<SrPerformancePrintPayloadDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = getSrPerformancePrintPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const scope = await buildTerritoryScope(user.id);

  try {
    const result = await getSrPerformancePrintPayloadRead(parsed.data, scope);
    return ok(toPrintPayloadDTO(result));
  } catch (error) {
    return fromSrPerformanceError(error);
  }
}
