"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import {
  listTerritoryAssignmentsForUser,
} from "@/lib/rbac/territory";
import { revokeTerritoryAssignmentSchema } from "@/lib/rbac/territory/territory-validation";
import type { ActionResult, TerritoryAssignmentRecord } from "@/lib/rbac/territory";

import { fail, fromPrismaError, fromZodError, ok } from "./helpers";

/**
 * Revokes an active territory assignment. Super Admin only.
 */
export async function revokeTerritoryAssignment(
  input: unknown,
): Promise<ActionResult<TerritoryAssignmentRecord>> {
  try {
    await requirePermission("settings:view");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = revokeTerritoryAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { assignmentId } = parsed.data;

  try {
    const existing = await prisma.userTerritoryAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, userId: true, isActive: true },
    });

    if (!existing) {
      return fail("ASSIGNMENT_NOT_FOUND", "territoryAssignment.error.notFound");
    }

    await prisma.userTerritoryAssignment.update({
      where: { id: assignmentId },
      data: {
        isActive: false,
        isPrimary: false,
        revokedAt: new Date(),
      },
    });

    const assignments = await listTerritoryAssignmentsForUser(existing.userId);
    const revoked = assignments.find((row) => row.id === assignmentId);
    if (!revoked) {
      return fail("INTERNAL_ERROR", "common.error.unexpected");
    }

    return ok(revoked);
  } catch (error) {
    return fromPrismaError(error);
  }
}
