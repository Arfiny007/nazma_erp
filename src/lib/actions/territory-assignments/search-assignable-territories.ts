"use server";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { searchAssignableTerritoriesSchema } from "@/lib/rbac/territory/territory-validation";
import type {
  ActionResult,
  AssignableTerritoryDTO,
  PaginatedResult,
} from "@/lib/rbac/territory";

import { fail, fromZodError, ok } from "./helpers";

/**
 * Searches active territories eligible for user assignment.
 */
export async function searchAssignableTerritories(
  input: unknown = {},
): Promise<ActionResult<PaginatedResult<AssignableTerritoryDTO>>> {
  try {
    await requirePermission("settings:view");
  } catch {
    return fail("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = searchAssignableTerritoriesSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { page, pageSize, search } = parsed.data;

  const where: Prisma.TerritoryWhereInput = { isActive: true };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { nameBn: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { district: { name: { contains: search, mode: "insensitive" } } },
      { district: { division: { name: { contains: search, mode: "insensitive" } } } },
    ];
  }

  const [total, territories] = await prisma.$transaction([
    prisma.territory.count({ where }),
    prisma.territory.findMany({
      where,
      include: {
        district: {
          include: { division: { select: { name: true } } },
        },
      },
      orderBy: [
        { district: { division: { sortOrder: "asc" } } },
        { district: { sortOrder: "asc" } },
        { sortOrder: "asc" },
        { name: "asc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const pageCount = total === 0 ? 0 : Math.ceil(total / pageSize);

  return ok({
    items: territories.map((territory) => ({
      id: territory.id,
      code: territory.code,
      name: territory.name,
      nameBn: territory.nameBn,
      districtName: territory.district.name,
      divisionName: territory.district.division.name,
      isActive: territory.isActive,
    })),
    total,
    page,
    pageSize,
    pageCount,
  });
}
