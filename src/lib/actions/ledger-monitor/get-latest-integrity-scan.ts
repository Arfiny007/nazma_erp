"use server";

import { getLatestIntegrityScan } from "@/lib/ledger/monitor";
import { requirePermission } from "@/lib/rbac/guards";
import type { ActionResult } from "@/types/ledger-statement";

import { fail, ok } from "../ledger-statement/helpers";

/**
 * Fetch the most recent persisted integrity scan — PHASE_07E4.
 * Financial administration only (`invoices:create`).
 */
export async function getLatestIntegrityScanAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof getLatestIntegrityScan>>>
> {
  try {
    await requirePermission("invoices:create");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  try {
    const scan = await getLatestIntegrityScan();
    return ok(scan);
  } catch {
    return fail("INTERNAL_ERROR", "common.error.unexpected");
  }
}
