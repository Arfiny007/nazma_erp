"use server";

import { z } from "zod";

import {
  DealerReconciliationNotFoundError,
  reconcileDealer,
} from "@/lib/ledger/reconciliation";
import { requirePermission } from "@/lib/rbac/guards";
import type { ActionResult } from "@/types/ledger-statement";

import { fail, ok } from "../ledger-statement/helpers";

const dealerCodeSchema = z.object({
  dealerCode: z.string().min(1, "dealerCode is required"),
});

/**
 * Reconcile a single dealer — read-only PHASE_07E3.
 */
export async function reconcileDealerAction(
  input: z.infer<typeof dealerCodeSchema>,
): Promise<ActionResult<Awaited<ReturnType<typeof reconcileDealer>>>> {
  try {
    await requirePermission("ledger:view");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = dealerCodeSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "validation.failed");
  }

  try {
    const result = await reconcileDealer(parsed.data.dealerCode);
    return ok(result);
  } catch (error) {
    if (error instanceof DealerReconciliationNotFoundError) {
      return fail("DEALER_NOT_FOUND", "ledgerReconciliation.error.dealerNotFound");
    }
    return fail("INTERNAL_ERROR", "common.error.unexpected");
  }
}
