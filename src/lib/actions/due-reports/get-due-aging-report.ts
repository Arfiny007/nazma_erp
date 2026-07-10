"use server";

import { getDueAgingReport as getDueAgingReportRead } from "@/lib/reports/due";
import { requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import { getDueAgingReportSchema } from "@/lib/validators/due-report.schema";
import type { ActionResult, DueAgingReportResultDTO } from "@/types/due-report";

import { fail, fromDueReportError, fromZodError, ok } from "./helpers";
import { toDueAgingReportResultDTO } from "./mappers";

/**
 * Invoice aging report — PHASE_08D.
 */
export async function getDueAgingReport(
  input: unknown = {},
): Promise<ActionResult<DueAgingReportResultDTO>> {
  let user;
  try {
    user = await requirePermission("reports:view");
  } catch {
    return fail<DueAgingReportResultDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = getDueAgingReportSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const scope = await buildTerritoryScope(user.id);

  try {
    const result = await getDueAgingReportRead(
      {
        divisionId: parsed.data.divisionId,
        districtId: parsed.data.districtId,
        territoryId: parsed.data.territoryId,
        assignedSrId: parsed.data.assignedSrId,
        dealerCode: parsed.data.dealerCode,
        asOfDate: parsed.data.asOfDate,
      },
      scope,
    );
    return ok(toDueAgingReportResultDTO(result));
  } catch (error) {
    return fromDueReportError(error);
  }
}
