"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { dealerProjectsSchema } from "@/lib/validators/order.schema";
import type { ActionResult, OrderProjectDTO } from "@/types/order";

import { fail, fromPrismaError, fromZodError, ok } from "./helpers";

/**
 * Lists the active projects belonging to a dealer, for the order form's
 * "existing project" selector. Read-only; guarded by `orders:view` so every
 * role that can view orders can resolve a dealer's projects while drafting.
 */
export async function listDealerProjects(
  input: unknown,
): Promise<ActionResult<OrderProjectDTO[]>> {
  try {
    await requirePermission("orders:view");
  } catch {
    return fail<OrderProjectDTO[]>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = dealerProjectsSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const projects = await prisma.project.findMany({
      where: {
        isActive: true,
        dealer: { dealerCode: parsed.data.dealerCode },
      },
      select: { id: true, projectCode: true, name: true },
      orderBy: { name: "asc" },
    });

    return ok(
      projects.map((project) => ({
        id: project.id,
        projectCode: project.projectCode,
        name: project.name,
      })),
    );
  } catch (error) {
    return fromPrismaError(error);
  }
}
