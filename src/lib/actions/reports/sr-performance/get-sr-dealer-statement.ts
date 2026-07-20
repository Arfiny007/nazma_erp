"use server";

import {
  getSrDealerStatement as getSrDealerStatementRead,
  toDealerStatementResultDTO,
} from "@/lib/reports/sr-performance";
import { requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import { getSrDealerStatementSchema } from "@/lib/validators/sr-performance.schema";
import type {
  ActionResult,
  SrDealerStatementResultDTO,
} from "@/types/sr-performance";

import { fail, fromSrPerformanceError, fromZodError, ok } from "./helpers";

/**
 * Individual SR dealer statement — PHASE_12A. Read-only.
 */
export async function getSrDealerStatement(
  input: unknown = {},
): Promise<ActionResult<SrDealerStatementResultDTO>> {
  let user;
  try {
    user = await requirePermission("reports:sr-performance:view");
  } catch {
    return fail<SrDealerStatementResultDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = getSrDealerStatementSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const scope = await buildTerritoryScope(user.id);

  try {
    const result = await getSrDealerStatementRead(parsed.data, scope);
    return ok(toDealerStatementResultDTO(result));
  } catch (error) {
    return fromSrPerformanceError(error);
  }
}
