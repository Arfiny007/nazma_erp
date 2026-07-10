"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import {
  isAssignableTerritoryRole,
  listTerritoryAssignmentsForUser,
} from "@/lib/rbac/territory";
import { assignTerritorySchema } from "@/lib/rbac/territory/territory-validation";
import type { ActionResult, TerritoryAssignmentRecord } from "@/lib/rbac/territory";

import { fail, fromPrismaError, fromZodError, ok } from "./helpers";

/**
 * Assigns a user to a sales territory. Super Admin only (settings:view).
 */
export async function assignTerritory(
  input: unknown,
): Promise<ActionResult<TerritoryAssignmentRecord>> {
  try {
    await requirePermission("settings:view");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = assignTerritorySchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { userId, territoryId, isPrimary } = parsed.data;

  try {
    const [user, territory] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, isActive: true },
      }),
      prisma.territory.findUnique({
        where: { id: territoryId },
        select: { id: true, isActive: true },
      }),
    ]);

    if (!user?.isActive) {
      return fail("USER_NOT_FOUND", "territoryAssignment.error.userNotFound");
    }
    if (!territory?.isActive) {
      return fail("TERRITORY_NOT_FOUND", "territoryAssignment.error.territoryNotFound");
    }
    if (!isAssignableTerritoryRole(user.role)) {
      return fail("ROLE_NOT_ASSIGNABLE", "territoryAssignment.error.roleNotAssignable");
    }

    await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.userTerritoryAssignment.updateMany({
          where: { userId, isActive: true, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      await tx.userTerritoryAssignment.upsert({
        where: {
          userId_territoryId: { userId, territoryId },
        },
        update: {
          isActive: true,
          isPrimary,
          revokedAt: null,
          assignedAt: new Date(),
        },
        create: {
          userId,
          territoryId,
          isPrimary,
          isActive: true,
        },
      });
    });

    const assignments = await listTerritoryAssignmentsForUser(userId);
    const assignment = assignments.find(
      (row) => row.territoryId === territoryId && row.isActive,
    );

    if (!assignment) {
      return fail("INTERNAL_ERROR", "common.error.unexpected");
    }

    return ok(assignment);
  } catch (error) {
    return fromPrismaError(error);
  }
}
