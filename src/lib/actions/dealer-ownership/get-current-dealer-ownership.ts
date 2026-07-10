"use server";

import { canAccessDealer } from "@/lib/rbac/territory";
import { requirePermission } from "@/lib/rbac/guards";
import { getCurrentDealerOwner } from "@/lib/dealers/ownership";
import { dealerOwnershipHistorySchema } from "@/lib/dealers/ownership/ownership-validation";
import type {
  DealerOwnershipRecord,
  OwnershipActionResult,
} from "@/lib/dealers/ownership/ownership-types";

import { fail, fromZodError, ok } from "./helpers";

export async function getCurrentDealerOwnership(
  input: unknown,
): Promise<OwnershipActionResult<DealerOwnershipRecord | null>> {
  let user;
  try {
    user = await requirePermission("dealers:view");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = dealerOwnershipHistorySchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const allowed = await canAccessDealer(user.id, parsed.data.dealerId);
  if (!allowed) {
    return fail("FORBIDDEN", "rbac.territory.noAccess");
  }

  const current = await getCurrentDealerOwner(parsed.data.dealerId);
  return ok(current);
}
