"use server";

import { requirePermission } from "@/lib/rbac/guards";
import {
  assertUserCanAssignTerritory,
  transferDealer as transferDealerService,
} from "@/lib/dealers/ownership";
import { transferDealerSchema } from "@/lib/dealers/ownership/ownership-validation";
import type {
  DealerOwnershipRecord,
  OwnershipActionResult,
} from "@/lib/dealers/ownership/ownership-types";

import { fail, fromOwnershipError, fromZodError, ok } from "./helpers";

export async function transferDealer(
  input: unknown,
): Promise<OwnershipActionResult<DealerOwnershipRecord>> {
  let user;
  try {
    user = await requirePermission("dealers:edit");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = transferDealerSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    await assertUserCanAssignTerritory(user.id, parsed.data.territoryId);
    const record = await transferDealerService({
      dealerId: parsed.data.dealerId,
      territoryId: parsed.data.territoryId,
      assignedById: user.id,
      assignedSrId: parsed.data.assignedSrId ?? null,
      reason: parsed.data.reason,
    });
    return ok(record);
  } catch (error) {
    return fromOwnershipError(error);
  }
}
