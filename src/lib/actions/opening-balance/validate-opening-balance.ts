"use server";

import { revalidatePath } from "next/cache";

import {
  loadOpeningBalanceDTO,
  validateOpeningBalanceDraft,
} from "@/lib/finance/initialization/opening-balance-service";
import { requirePermission } from "@/lib/rbac/guards";
import { openingBalanceIdentifierSchema } from "@/lib/validators/opening-balance.schema";
import type {
  ActionResult,
  OpeningBalanceValidationResultDTO,
} from "@/types/opening-balance";

import { fail, fromPrismaError, fromZodError, ok } from "./helpers";

/**
 * Runs business validation on a Draft Opening Balance and, when every check
 * passes, transitions it to Validated — the wizard's Validation step.
 *
 * NEVER touches `Dealer.currentBalance` or the ledger. Returns field-level
 * issues (not an error envelope) when validation fails, so the wizard can
 * render them inline and let the user correct the Draft.
 */
export async function validateOpeningBalance(
  input: unknown,
): Promise<ActionResult<OpeningBalanceValidationResultDTO>> {
  let user;
  try {
    user = await requirePermission("invoices:create");
  } catch {
    return fail<OpeningBalanceValidationResultDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = openingBalanceIdentifierSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const outcome = await validateOpeningBalanceDraft(parsed.data.id, user.id);

    if (!outcome.valid) {
      return ok({
        valid: false,
        issues: outcome.issues,
        openingBalance: null,
      });
    }

    const dto = await loadOpeningBalanceDTO(parsed.data.id);

    revalidatePath("/opening-balances");
    revalidatePath(`/opening-balances/${parsed.data.id}`);

    return ok({
      valid: true,
      issues: [],
      openingBalance: dto,
    });
  } catch (error) {
    return fromPrismaError<OpeningBalanceValidationResultDTO>(error);
  }
}
