"use server";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import {
  buildTerritoryScope,
  canAccessDealer,
  mergeDealerTerritoryScope,
} from "@/lib/rbac/territory";
import { listDealersSchema } from "@/lib/validators/dealer.schema";
import type { ActionResult, DealerDTO, PaginatedResult } from "@/types/dealer";

import { fail, fromPrismaError, fromZodError, ok, toDealerDTO } from "./helpers";

/**
 * Returns a paginated, filterable, sortable list of dealers.
 *
 * Supports free-text search across code, company, proprietor and mobile, plus
 * district / territory / active filters. Count and page query run in a single
 * read transaction so totals stay consistent with the returned page.
 */
export async function listDealers(
  input: unknown = {},
): Promise<ActionResult<PaginatedResult<DealerDTO>>> {
  let user;
  try {
    user = await requirePermission("dealers:view");
  } catch {
    return fail<PaginatedResult<DealerDTO>>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = listDealersSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { page, pageSize, search, district, territory, isActive, sortBy, sortOrder } =
    parsed.data;

  const where: Prisma.DealerWhereInput = {};

  if (typeof isActive === "boolean") {
    where.isActive = isActive;
  }
  if (district) {
    where.district = { equals: district, mode: "insensitive" };
  }
  if (territory) {
    where.territory = { equals: territory, mode: "insensitive" };
  }
  if (search) {
    where.OR = [
      { dealerCode: { contains: search, mode: "insensitive" } },
      { companyName: { contains: search, mode: "insensitive" } },
      { proprietorName: { contains: search, mode: "insensitive" } },
      { mobile: { contains: search } },
    ];
  }

  const scope = await buildTerritoryScope(user.id);
  const scopedWhere = mergeDealerTerritoryScope(where, scope);

  try {
    const [total, dealers] = await prisma.$transaction([
      prisma.dealer.count({ where: scopedWhere }),
      prisma.dealer.findMany({
        where: scopedWhere,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const pageCount = total === 0 ? 0 : Math.ceil(total / pageSize);

    return ok({
      items: dealers.map(toDealerDTO),
      total,
      page,
      pageSize,
      pageCount,
    });
  } catch (error) {
    return fromPrismaError(error);
  }
}
