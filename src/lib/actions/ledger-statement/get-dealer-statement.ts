"use server";

import { getDealerStatement as getDealerStatementRead } from "@/lib/ledger/statement";
import { requirePermission } from "@/lib/rbac/guards";
import { getDealerStatementSchema } from "@/lib/validators/ledger-statement.schema";
import type { ActionResult, DealerStatementDTO } from "@/types/ledger-statement";

import { fail, fromStatementError, fromZodError, ok } from "./helpers";
import { toDealerStatementDTO } from "./mappers";

/**
 * Returns a paginated Dealer Statement — PHASE_07D1.
 *
 * READ ONLY. Delegates entirely to `src/lib/ledger/statement/
 * dealer-statement-service.ts`; this action only enforces `ledger:view`,
 * validates raw input shape, and converts the Decimal-based domain result
 * into a transport-safe DTO. It never touches `Invoice`, `Collection`,
 * `posting-service.ts`, or any write path.
 */
export async function getDealerStatement(
  input: unknown,
): Promise<ActionResult<DealerStatementDTO>> {
  try {
    await requirePermission("ledger:view");
  } catch {
    return fail<DealerStatementDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = getDealerStatementSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const result = await getDealerStatementRead(parsed.data);
    return ok(toDealerStatementDTO(result));
  } catch (error) {
    return fromStatementError<DealerStatementDTO>(error);
  }
}
