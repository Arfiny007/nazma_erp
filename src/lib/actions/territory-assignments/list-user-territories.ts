"use server";

import { requirePermission } from "@/lib/rbac/guards";
import { listTerritoryAssignmentsForUser } from "@/lib/rbac/territory";
import { listUserTerritoriesSchema } from "@/lib/rbac/territory/territory-validation";
import type { ActionResult, TerritoryAssignmentRecord } from "@/lib/rbac/territory";

import { fail, fromZodError, ok } from "./helpers";

/**
 * Lists all territory assignments for a user (active and revoked).
 */
export async function listUserTerritories(
  input: unknown,
): Promise<ActionResult<TerritoryAssignmentRecord[]>> {
  try {
    await requirePermission("settings:view");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = listUserTerritoriesSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const assignments = await listTerritoryAssignmentsForUser(parsed.data.userId);
  return ok(assignments);
}
