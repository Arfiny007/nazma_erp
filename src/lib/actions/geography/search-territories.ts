"use server";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { searchTerritoriesSchema } from "@/lib/validators/geography.schema";
import type {
  ActionResult,
  PaginatedResult,
  TerritoryDTO,
} from "@/types/geography";

import { fromPrismaError, fromZodError, ok, toTerritoryDTO } from "./helpers";

/**
 * Paginated territory search across name, code, district, and division.
 */
export async function searchTerritories(
  input: unknown = {},
): Promise<ActionResult<PaginatedResult<TerritoryDTO>>> {
  const parsed = searchTerritoriesSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { page, pageSize, search, divisionId, districtId, activeOnly } =
    parsed.data;

  const where: Prisma.TerritoryWhereInput = {};

  if (activeOnly) {
    where.isActive = true;
  }
  if (districtId) {
    where.districtId = districtId;
  }
  if (divisionId) {
    where.district = { divisionId };
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { nameBn: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { district: { name: { contains: search, mode: "insensitive" } } },
      { district: { division: { name: { contains: search, mode: "insensitive" } } } },
    ];
  }

  try {
    await requirePermission("settings:view");

    const [total, territories] = await prisma.$transaction([
      prisma.territory.count({ where }),
      prisma.territory.findMany({
        where,
        include: {
          district: {
            include: {
              division: { select: { id: true, code: true, name: true } },
            },
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
      items: territories.map(toTerritoryDTO),
      total,
      page,
      pageSize,
      pageCount,
    });
  } catch (error) {
    return fromPrismaError(error);
  }
}
