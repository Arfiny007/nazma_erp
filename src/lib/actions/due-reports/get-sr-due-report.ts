"use server";

import { getSrDueReport as getSrDueReportRead } from "@/lib/reports/due";
import { requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import { getSrDueReportSchema } from "@/lib/validators/due-report.schema";
import type { ActionResult, SrDueReportResultDTO } from "@/types/due-report";

import { fail, fromDueReportError, fromZodError, ok } from "./helpers";
import { toSrDueReportResultDTO } from "./mappers";

/**
 * SR-grouped due aggregation — PHASE_08D.
 */
export async function getSrDueReport(
  input: unknown = {},
): Promise<ActionResult<SrDueReportResultDTO>> {
  let user;
  try {
    user = await requirePermission("reports:view");
  } catch {
    return fail<SrDueReportResultDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = getSrDueReportSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const scope = await buildTerritoryScope(user.id);

  try {
    const result = await getSrDueReportRead(
      {
        divisionId: parsed.data.divisionId,
        districtId: parsed.data.districtId,
        territoryId: parsed.data.territoryId,
        fromDate: parsed.data.fromDate,
        toDate: parsed.data.toDate,
      },
      scope,
    );
    return ok(toSrDueReportResultDTO(result));
  } catch (error) {
    return fromDueReportError(error);
  }
}
