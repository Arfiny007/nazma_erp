"use server";

import {
  getReconciliationSummary,
} from "@/lib/ledger/reconciliation";
import { requirePermission } from "@/lib/rbac/guards";
import type { ActionResult } from "@/types/ledger-statement";

import { fail, ok } from "../ledger-statement/helpers";

/**
 * Full reconciliation report with per-dealer rows — read-only PHASE_07E3.
 */
export async function getReconciliationSummaryAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof getReconciliationSummary>>>
> {
  try {
    await requirePermission("ledger:view");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  try {
    const report = await getReconciliationSummary();
    return ok(report);
  } catch {
    return fail("INTERNAL_ERROR", "common.error.unexpected");
  }
}
