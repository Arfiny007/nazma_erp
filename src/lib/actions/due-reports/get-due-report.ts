"use server";

import { getDueReport as getDueReportRead } from "@/lib/reports/due";
import { requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import { getDueReportSchema } from "@/lib/validators/due-report.schema";
import type { ActionResult, DueReportResultDTO } from "@/types/due-report";

import { fail, fromDueReportError, fromZodError, ok, parseOptionalDecimal } from "./helpers";
import { toDueReportResultDTO } from "./mappers";

/**
 * Paginated dealer due report — PHASE_08D.
 * Read-only; consumes `Dealer.currentBalance` verbatim.
 */
export async function getDueReport(
  input: unknown = {},
): Promise<ActionResult<DueReportResultDTO>> {
  let user;
  try {
    user = await requirePermission("reports:view");
  } catch {
    return fail<DueReportResultDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = getDueReportSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const scope = await buildTerritoryScope(user.id);

  try {
    const result = await getDueReportRead(
      {
        divisionId: parsed.data.divisionId,
        districtId: parsed.data.districtId,
        territoryId: parsed.data.territoryId,
        assignedSrId: parsed.data.assignedSrId,
        dealerCode: parsed.data.dealerCode,
        agingBucket: parsed.data.agingBucket,
        balanceMin: parseOptionalDecimal(parsed.data.balanceMin),
        balanceMax: parseOptionalDecimal(parsed.data.balanceMax),
        fromDate: parsed.data.fromDate,
        toDate: parsed.data.toDate,
        includeZeroBalance: parsed.data.includeZeroBalance,
        includeAdvance: parsed.data.includeAdvance,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
      },
      scope,
    );
    return ok(toDueReportResultDTO(result));
  } catch (error) {
    return fromDueReportError(error);
  }
}
