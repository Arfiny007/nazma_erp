"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import type { ActionResult, DivisionDTO } from "@/types/geography";

import { fromPrismaError, ok, toDivisionDTO } from "./helpers";

/**
 * Returns all active Bangladesh divisions ordered by `sortOrder`.
 */
export async function listDivisions(): Promise<ActionResult<DivisionDTO[]>> {
  try {
    await requirePermission("dealers:view");

    const divisions = await prisma.division.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return ok(divisions.map(toDivisionDTO));
  } catch (error) {
    return fromPrismaError(error);
  }
}
