"use server";

import { getCompanyDueSummary as getCompanyDueSummaryRead } from "@/lib/reports/due";
import { requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import { getCompanyDueSummarySchema } from "@/lib/validators/due-report.schema";
import type { ActionResult, CompanyDueSummaryDTO } from "@/types/due-report";

import { fail, fromDueReportError, fromZodError, ok } from "./helpers";
import { toCompanyDueSummaryDTO } from "./mappers";

/**
 * Company-wide due summary — PHASE_08D.
 */
export async function getCompanyDueSummary(
  input: unknown = {},
): Promise<ActionResult<CompanyDueSummaryDTO>> {
  let user;
  try {
    user = await requirePermission("reports:view");
  } catch {
    return fail<CompanyDueSummaryDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = getCompanyDueSummarySchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const scope = await buildTerritoryScope(user.id);

  try {
    const result = await getCompanyDueSummaryRead(
      {
        divisionId: parsed.data.divisionId,
        districtId: parsed.data.districtId,
        territoryId: parsed.data.territoryId,
        assignedSrId: parsed.data.assignedSrId,
        fromDate: parsed.data.fromDate,
        toDate: parsed.data.toDate,
      },
      scope,
    );
    return ok(toCompanyDueSummaryDTO(result));
  } catch (error) {
    return fromDueReportError(error);
  }
}
