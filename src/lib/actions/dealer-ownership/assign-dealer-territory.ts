"use server";

import { requirePermission } from "@/lib/rbac/guards";
import {
  assertUserCanAssignTerritory,
  assignDealerTerritory as assignDealerTerritoryService,
} from "@/lib/dealers/ownership";
import { assignDealerTerritorySchema } from "@/lib/dealers/ownership/ownership-validation";
import type { OwnershipActionResult } from "@/lib/dealers/ownership/ownership-types";
import type { DealerOwnershipRecord } from "@/lib/dealers/ownership/ownership-types";

import { fail, fromOwnershipError, fromZodError, ok } from "./helpers";

export async function assignDealerTerritory(
  input: unknown,
): Promise<OwnershipActionResult<DealerOwnershipRecord>> {
  let user;
  try {
    user = await requirePermission("dealers:edit");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = assignDealerTerritorySchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    await assertUserCanAssignTerritory(user.id, parsed.data.territoryId);
    const record = await assignDealerTerritoryService({
      dealerId: parsed.data.dealerId,
      territoryId: parsed.data.territoryId,
      assignedById: user.id,
      assignedSrId: parsed.data.assignedSrId ?? null,
      reason: parsed.data.reason ?? null,
    });
    return ok(record);
  } catch (error) {
    return fromOwnershipError(error);
  }
}
