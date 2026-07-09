"use server";

import { revalidatePath } from "next/cache";

import {
  loadOpeningBalanceDTO,
  postOpeningBalanceDraft,
} from "@/lib/finance/initialization/opening-balance-service";
import { requirePermission } from "@/lib/rbac/guards";
import { openingBalanceIdentifierSchema } from "@/lib/validators/opening-balance.schema";
import type {
  ActionResult,
  OpeningBalancePostResultDTO,
} from "@/types/opening-balance";

import { fail, fromPrismaError, fromZodError, ok } from "./helpers";

/**
 * Posts a Validated Opening Balance — the wizard's Posting step.
 *
 * Routes exclusively through `posting-service.postOpeningBalance()`, which
 * is the only writer of `Dealer.currentBalance` and `LedgerEntry`. Posting
 * transitions the record straight to Locked (there is no intermediate
 * reviewable "Posted, not yet Locked" state — ADR-028 §4).
 *
 * Idempotent: calling this twice for the same record never creates a second
 * `LedgerEntry` or double-applies the balance — the second call detects
 * `Locked` and returns the existing result with `alreadyPosted: true`.
 */
export async function postOpeningBalance(
  input: unknown,
): Promise<ActionResult<OpeningBalancePostResultDTO>> {
  let user;
  try {
    user = await requirePermission("invoices:create");
  } catch {
    return fail<OpeningBalancePostResultDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = openingBalanceIdentifierSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const outcome = await postOpeningBalanceDraft(parsed.data.id, user.id);

    const dto = await loadOpeningBalanceDTO(outcome.record.id);
    if (!dto) {
      return fail<OpeningBalancePostResultDTO>(
        "RECORD_NOT_FOUND",
        "openingBalance.error.notFound",
      );
    }

    revalidatePath("/opening-balances");
    revalidatePath(`/opening-balances/${outcome.record.id}`);
    revalidatePath("/dealers");
    revalidatePath(`/dealers/${outcome.record.dealerCode}`);

    return ok({ openingBalance: dto, alreadyPosted: outcome.alreadyPosted });
  } catch (error) {
    return fromPrismaError<OpeningBalancePostResultDTO>(error);
  }
}
