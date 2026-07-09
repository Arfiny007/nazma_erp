"use server";

import { z } from "zod";

import {
  getReplayStatus,
  LedgerReplayChainCorruptedError,
  LedgerReplayNotEligibleError,
  LedgerReplayParityError,
} from "@/lib/ledger/backfill";
import { requireAllPermissions } from "@/lib/rbac/guards";
import type { ActionResult } from "@/types/ledger-statement";

import { fail, ok } from "../ledger-statement/helpers";

const dealerCodeSchema = z.object({
  dealerCode: z.string().min(1, "dealerCode is required"),
});

/**
 * Replay eligibility and status for one dealer — PHASE_07E2.
 */
export async function getReplayStatusAction(
  input: z.infer<typeof dealerCodeSchema>,
): Promise<ActionResult<Awaited<ReturnType<typeof getReplayStatus>>>> {
  try {
    await requireAllPermissions("ledger:view", "invoices:create");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = dealerCodeSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "validation.failed");
  }

  try {
    const status = await getReplayStatus(parsed.data.dealerCode);
    return ok(status);
  } catch (error) {
    return fromReplayError(error);
  }
}

function fromReplayError<T>(error: unknown): ActionResult<T> {
  if (error instanceof LedgerReplayNotEligibleError) {
    return fail("VALIDATION_ERROR", "ledgerBackfill.error.notEligible");
  }
  if (error instanceof LedgerReplayChainCorruptedError) {
    return fail("VALIDATION_ERROR", "ledgerBackfill.error.corruptedChain");
  }
  if (error instanceof LedgerReplayParityError) {
    return fail("VALIDATION_ERROR", "ledgerBackfill.error.parityMismatch");
  }
  return fail("INTERNAL_ERROR", "common.error.unexpected");
}
