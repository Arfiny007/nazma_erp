"use server";

import { revalidatePath } from "next/cache";

import {
  runFinancialIntegrityScan,
} from "@/lib/ledger/monitor";
import { requirePermission } from "@/lib/rbac/guards";
import type { ActionResult } from "@/types/ledger-statement";

import { fail, ok } from "../ledger-statement/helpers";

/**
 * Execute a repository-wide financial integrity scan — PHASE_07E4.
 * Financial administration only (`invoices:create`).
 */
export async function runFinancialIntegrityScanAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof runFinancialIntegrityScan>>>
> {
  try {
    await requirePermission("invoices:create");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  try {
    const result = await runFinancialIntegrityScan();
    revalidatePath("/ledger/integrity");
    return ok(result);
  } catch {
    return fail("INTERNAL_ERROR", "common.error.unexpected");
  }
}
