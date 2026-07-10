"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { listDistrictsByDivisionSchema } from "@/lib/validators/geography.schema";
import type { ActionResult, DistrictDTO } from "@/types/geography";

import {
  fail,
  fromPrismaError,
  fromZodError,
  ok,
  toDistrictDTO,
} from "./helpers";

/**
 * Returns districts belonging to the given division.
 */
export async function listDistrictsByDivision(
  input: unknown,
): Promise<ActionResult<DistrictDTO[]>> {
  const parsed = listDistrictsByDivisionSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { divisionId, activeOnly } = parsed.data;

  try {
    await requirePermission("dealers:view");

    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      select: { id: true },
    });

    if (!division) {
      return fail("DIVISION_NOT_FOUND", "geography.error.divisionNotFound");
    }

    const districts = await prisma.district.findMany({
      where: {
        divisionId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: {
        division: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return ok(districts.map(toDistrictDTO));
  } catch (error) {
    return fromPrismaError(error);
  }
}
