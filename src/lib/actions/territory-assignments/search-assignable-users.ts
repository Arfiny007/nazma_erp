"use server";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { ASSIGNABLE_TERRITORY_ROLES } from "@/lib/rbac/territory";
import { searchAssignableUsersSchema } from "@/lib/rbac/territory/territory-validation";
import type {
  ActionResult,
  AssignableUserDTO,
  PaginatedResult,
} from "@/lib/rbac/territory";

import { fail, fromZodError, ok } from "./helpers";

/**
 * Searches SR and Manager users eligible for territory assignment.
 */
export async function searchAssignableUsers(
  input: unknown = {},
): Promise<ActionResult<PaginatedResult<AssignableUserDTO>>> {
  try {
    await requirePermission("settings:view");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = searchAssignableUsersSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { page, pageSize, search } = parsed.data;

  const where: Prisma.UserWhereInput = {
    isActive: true,
    role: { in: [...ASSIGNABLE_TERRITORY_ROLES] },
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, isActive: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const pageCount = total === 0 ? 0 : Math.ceil(total / pageSize);

  return ok({
    items: users,
    total,
    page,
    pageSize,
    pageCount,
  });
}
