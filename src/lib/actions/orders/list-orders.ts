"use server";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import {
  buildTerritoryScope,
  canAccessOrder,
  mergeOrderTerritoryScope,
} from "@/lib/rbac/territory";
import { listOrdersSchema } from "@/lib/validators/order.schema";
import type {
  ActionResult,
  OrderSummaryDTO,
  PaginatedResult,
} from "@/types/order";

import {
  fail,
  fromPrismaError,
  fromZodError,
  ok,
  orderSummaryInclude,
  toOrderSummaryDTO,
} from "./helpers";

/**
 * Returns a paginated, filterable, sortable list of sales orders.
 *
 * Search backend supports:
 *   - Order Number (free-text, via `search`)
 *   - Dealer (free-text company name via `search`, or exact `dealerCode`)
 *   - Project (free-text project name via `search`, or exact `projectId`)
 *   - Status (exact `status`)
 *   - Date range (`dateFrom` / `dateTo` against `createdAt`)
 *
 * Count and page query run in a single read transaction so totals stay
 * consistent with the returned page.
 */
export async function listOrders(
  input: unknown = {},
): Promise<ActionResult<PaginatedResult<OrderSummaryDTO>>> {
  let user;
  try {
    user = await requirePermission("orders:view");
  } catch {
    return fail<PaginatedResult<OrderSummaryDTO>>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = listOrdersSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const {
    page,
    pageSize,
    search,
    dealerCode,
    projectId,
    status,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
  } = parsed.data;

  const where: Prisma.SalesOrderWhereInput = {};

  if (status) {
    where.status = status;
  }
  if (dealerCode) {
    where.dealerCode = dealerCode;
  }
  if (projectId) {
    where.projectId = projectId;
  }
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      where.createdAt.gte = dateFrom;
    }
    if (dateTo) {
      where.createdAt.lte = dateTo;
    }
  }
  if (search) {
    where.OR = [
      { orderNo: { contains: search, mode: "insensitive" } },
      { dealer: { companyName: { contains: search, mode: "insensitive" } } },
      { project: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const scope = await buildTerritoryScope(user.id);
  const scopedWhere = mergeOrderTerritoryScope(where, scope);

  try {
    const [total, orders] = await prisma.$transaction([
      prisma.salesOrder.count({ where: scopedWhere }),
      prisma.salesOrder.findMany({
        where: scopedWhere,
        include: orderSummaryInclude,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const pageCount = total === 0 ? 0 : Math.ceil(total / pageSize);

    return ok({
      items: orders.map(toOrderSummaryDTO),
      total,
      page,
      pageSize,
      pageCount,
    });
  } catch (error) {
    return fromPrismaError(error);
  }
}
