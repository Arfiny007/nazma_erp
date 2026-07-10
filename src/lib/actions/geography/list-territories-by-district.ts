"use server";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { listTerritoriesByDistrictSchema } from "@/lib/validators/geography.schema";
import type { ActionResult, TerritoryDTO } from "@/types/geography";

import {
  fail,
  fromPrismaError,
  fromZodError,
  ok,
  toTerritoryDTO,
} from "./helpers";

/**
 * Returns sales territories within the given district.
 */
export async function listTerritoriesByDistrict(
  input: unknown,
): Promise<ActionResult<TerritoryDTO[]>> {
  const parsed = listTerritoriesByDistrictSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { districtId, activeOnly } = parsed.data;

  try {
    await requirePermission("dealers:view");

    const district = await prisma.district.findUnique({
      where: { id: districtId },
      select: { id: true },
    });

    if (!district) {
      return fail("DISTRICT_NOT_FOUND", "geography.error.districtNotFound");
    }

    const territories = await prisma.territory.findMany({
      where: {
        districtId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: {
        district: {
          include: {
            division: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return ok(territories.map(toTerritoryDTO));
  } catch (error) {
    return fromPrismaError(error);
  }
}
