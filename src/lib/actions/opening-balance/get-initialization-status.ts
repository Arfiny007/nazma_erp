"use server";

import { getInitializationStatusForDealer } from "@/lib/finance/initialization/initialization-status";
import { requirePermission } from "@/lib/rbac/guards";
import { getInitializationStatusSchema } from "@/lib/validators/opening-balance.schema";
import type { ActionResult, InitializationStatusDTO } from "@/types/opening-balance";

import { fail, fromPrismaError, fromZodError, ok } from "./helpers";

/**
 * Returns a single dealer's Financial Initialization status — used by the
 * wizard to resume an in-progress Draft/Validated record, or to confirm a
 * dealer is already Locked before offering a redundant "start" affordance.
 */
export async function getInitializationStatus(
  input: unknown,
): Promise<ActionResult<InitializationStatusDTO>> {
  try {
    await requirePermission("invoices:create");
  } catch {
    return fail<InitializationStatusDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = getInitializationStatusSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const status = await getInitializationStatusForDealer(parsed.data.dealerCode);
    if (!status) {
      return fail<InitializationStatusDTO>(
        "DEALER_NOT_FOUND",
        "openingBalance.error.dealerNotFound",
      );
    }
    return ok(status);
  } catch (error) {
    return fromPrismaError<InitializationStatusDTO>(error);
  }
}
