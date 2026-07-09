"use server";

import { listUninitializedDealers as listUninitializedDealersQuery } from "@/lib/finance/initialization/initialization-status";
import { requirePermission } from "@/lib/rbac/guards";
import { listUninitializedDealersSchema } from "@/lib/validators/opening-balance.schema";
import type {
  ActionResult,
  PaginatedResult,
  UninitializedDealerDTO,
} from "@/types/opening-balance";

import { fail, fromPrismaError, fromZodError, ok } from "./helpers";

/**
 * Lists dealers eligible to start the Opening Balance wizard — the Dealer
 * Selection step's candidate pool. Excludes any dealer that already has an
 * `OpeningBalance` row (Draft or otherwise) — see
 * `listUninitializedDealers` in `initialization-status.ts` for the exact
 * exclusion rule.
 */
export async function listUninitializedDealers(
  input: unknown = {},
): Promise<ActionResult<PaginatedResult<UninitializedDealerDTO>>> {
  try {
    await requirePermission("invoices:create");
  } catch {
    return fail<PaginatedResult<UninitializedDealerDTO>>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = listUninitializedDealersSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const result = await listUninitializedDealersQuery(parsed.data);
    return ok(result);
  } catch (error) {
    return fromPrismaError<PaginatedResult<UninitializedDealerDTO>>(error);
  }
}
