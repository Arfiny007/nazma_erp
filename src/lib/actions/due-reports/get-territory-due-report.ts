"use server";

import { getTerritoryDueReport as getTerritoryDueReportRead } from "@/lib/reports/due";
import { requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import { getTerritoryDueReportSchema } from "@/lib/validators/due-report.schema";
import type { ActionResult, TerritoryDueReportResultDTO } from "@/types/due-report";

import { fail, fromDueReportError, fromZodError, ok } from "./helpers";
import { toTerritoryDueReportResultDTO } from "./mappers";

/**
 * Territory-grouped due aggregation — PHASE_08D.
 */
export async function getTerritoryDueReport(
  input: unknown = {},
): Promise<ActionResult<TerritoryDueReportResultDTO>> {
  let user;
  try {
    user = await requirePermission("reports:view");
  } catch {
    return fail<TerritoryDueReportResultDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = getTerritoryDueReportSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const scope = await buildTerritoryScope(user.id);

  try {
    const result = await getTerritoryDueReportRead(
      {
        groupBy: parsed.data.groupBy,
        divisionId: parsed.data.divisionId,
        districtId: parsed.data.districtId,
        territoryId: parsed.data.territoryId,
        assignedSrId: parsed.data.assignedSrId,
        fromDate: parsed.data.fromDate,
        toDate: parsed.data.toDate,
      },
      scope,
    );
    return ok(toTerritoryDueReportResultDTO(result));
  } catch (error) {
    return fromDueReportError(error);
  }
}
