"use server";

import { getDealerStatementSummary as getDealerStatementSummaryRead } from "@/lib/ledger/statement";
import { requirePermission } from "@/lib/rbac/guards";
import { canAccessDealerByCode } from "@/lib/rbac/territory";
import { getDealerStatementSummarySchema } from "@/lib/validators/ledger-statement.schema";
import type {
  ActionResult,
  DealerStatementSummaryDTO,
} from "@/types/ledger-statement";

import { fail, fromStatementError, fromZodError, ok } from "./helpers";
import { toDealerStatementSummaryDTO } from "./mappers";

/**
 * Returns a compact, non-paginated Dealer Statement summary — PHASE_07D1.
 *
 * READ ONLY. Same read engine as `getDealerStatement()`, sized for header
 * cards / quick lookups that only need balances and totals, not the row
 * list. See `dealer-statement-service.ts` for the underlying contract.
 */
export async function getDealerStatementSummary(
  input: unknown,
): Promise<ActionResult<DealerStatementSummaryDTO>> {
  let user;
  try {
    user = await requirePermission("ledger:view");
  } catch {
    return fail<DealerStatementSummaryDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = getDealerStatementSummarySchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const allowed = await canAccessDealerByCode(user.id, parsed.data.dealerCode);
  if (!allowed) {
    return fail<DealerStatementSummaryDTO>("FORBIDDEN", "rbac.territory.noAccess");
  }

  try {
    const result = await getDealerStatementSummaryRead(parsed.data);
    return ok(toDealerStatementSummaryDTO(result));
  } catch (error) {
    return fromStatementError<DealerStatementSummaryDTO>(error);
  }
}
