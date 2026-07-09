"use server";

import {
  getLedgerBackfillCandidates as getLedgerBackfillCandidatesRead,
  type LedgerBackfillDiscoveryResult,
} from "@/lib/ledger/backfill";
import { requirePermission } from "@/lib/rbac/guards";
import type { ActionResult } from "@/types/ledger-statement";

import { fail, ok } from "../ledger-statement/helpers";

/**
 * Returns dealers that require historical ledger reconstruction — PHASE_07E1.
 *
 * READ ONLY. Delegates to `src/lib/ledger/backfill/ledger-backfill-discovery.ts`.
 * Enforces `ledger:view` RBAC and returns transport-safe decimal strings.
 */
export async function getLedgerBackfillCandidates(): Promise<
  ActionResult<LedgerBackfillDiscoveryResult>
> {
  try {
    await requirePermission("ledger:view");
  } catch {
    return fail<LedgerBackfillDiscoveryResult>("FORBIDDEN", "rbac.noAccess");
  }

  try {
    const result = await getLedgerBackfillCandidatesRead();
    return ok(result);
  } catch {
    return fail<LedgerBackfillDiscoveryResult>(
      "INTERNAL_ERROR",
      "common.error.unexpected",
    );
  }
}
