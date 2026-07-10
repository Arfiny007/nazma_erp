"use server";

import { requirePermission } from "@/lib/rbac/guards";
import { backfillDealerOwnership } from "@/lib/dealers/ownership";
import type {
  BackfillDealerOwnershipReport,
  OwnershipActionResult,
} from "@/lib/dealers/ownership/ownership-types";

import { fail, fromOwnershipError, ok } from "./helpers";

export async function runDealerOwnershipBackfill(): Promise<
  OwnershipActionResult<BackfillDealerOwnershipReport>
> {
  let user;
  try {
    user = await requirePermission("settings:view");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  try {
    const report = await backfillDealerOwnership(user.id);
    return ok(report);
  } catch (error) {
    return fromOwnershipError(error);
  }
}
