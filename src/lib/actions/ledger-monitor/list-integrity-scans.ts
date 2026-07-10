"use server";

import { listIntegrityScans } from "@/lib/ledger/monitor";
import { requirePermission } from "@/lib/rbac/guards";
import type { ActionResult } from "@/types/ledger-statement";

import { fail, ok } from "../ledger-statement/helpers";

/**
 * List historical integrity scan summaries — PHASE_07E4.
 * Financial administration only (`invoices:create`).
 */
export async function listIntegrityScansAction(
  limit?: number,
): Promise<ActionResult<Awaited<ReturnType<typeof listIntegrityScans>>>> {
  try {
    await requirePermission("invoices:create");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  try {
    const scans = await listIntegrityScans({ limit });
    return ok(scans);
  } catch {
    return fail("INTERNAL_ERROR", "common.error.unexpected");
  }
}
