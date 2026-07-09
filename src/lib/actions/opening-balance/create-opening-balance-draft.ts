"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  createOpeningBalanceDraftForDealer,
  loadOpeningBalanceDTO,
} from "@/lib/finance/initialization/opening-balance-service";
import { requirePermission } from "@/lib/rbac/guards";
import { createOpeningBalanceDraftSchema } from "@/lib/validators/opening-balance.schema";
import type { ActionResult, OpeningBalanceDTO } from "@/types/opening-balance";

import { fail, fromPrismaError, fromZodError, ok } from "./helpers";

/**
 * Creates a Draft Opening Balance for a dealer — the first step of the
 * Financial Initialization wizard (Dealer Selection → Opening Balance Entry).
 *
 * Draft is editable and never touches `Dealer.currentBalance` or the ledger.
 * A dealer with ANY existing `OpeningBalance` row is rejected —
 * `ALREADY_INITIALIZED` — enforced by the unique `dealerCode` constraint.
 */
export async function createOpeningBalanceDraft(
  input: unknown,
): Promise<ActionResult<OpeningBalanceDTO>> {
  let user;
  try {
    user = await requirePermission("invoices:create");
  } catch {
    return fail<OpeningBalanceDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = createOpeningBalanceDraftSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { dealerCode, amount, effectiveDate, remarks } = parsed.data;

  try {
    const record = await createOpeningBalanceDraftForDealer({
      dealerCode,
      amount: new Prisma.Decimal(amount),
      effectiveDate,
      remarks: remarks ?? null,
      actorId: user.id,
    });

    const dto = await loadOpeningBalanceDTO(record.id);
    if (!dto) {
      return fail<OpeningBalanceDTO>(
        "RECORD_NOT_FOUND",
        "openingBalance.error.notFound",
      );
    }

    revalidatePath("/opening-balances");
    revalidatePath(`/opening-balances/${record.id}`);

    return ok(dto);
  } catch (error) {
    return fromPrismaError<OpeningBalanceDTO>(error);
  }
}
