"use server";

import {
  reconcileAllDealers,
} from "@/lib/ledger/reconciliation";
import { requirePermission } from "@/lib/rbac/guards";
import type { ActionResult } from "@/types/ledger-statement";

import { fail, ok } from "../ledger-statement/helpers";

/**
 * Reconcile every dealer — read-only PHASE_07E3.
 */
export async function reconcileAllDealersAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof reconcileAllDealers>>>
> {
  try {
    await requirePermission("ledger:view");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  try {
    const summary = await reconcileAllDealers();
    return ok(summary);
  } catch {
    return fail("INTERNAL_ERROR", "common.error.unexpected");
  }
}
