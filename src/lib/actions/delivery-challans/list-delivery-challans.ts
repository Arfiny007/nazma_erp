"use server";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { listDeliveryChallansSchema } from "@/lib/validators/delivery-challan.schema";
import type {
  ActionResult,
  DeliveryChallanSummaryDTO,
  PaginatedResult,
} from "@/types/delivery-challan";

import {
  challanSummaryInclude,
  fail,
  fromPrismaError,
  fromZodError,
  ok,
  toChallanSummaryDTO,
} from "./helpers";

/**
 * Returns a paginated, filterable list of delivery challans.
 */
export async function listDeliveryChallans(
  input: unknown = {},
): Promise<ActionResult<PaginatedResult<DeliveryChallanSummaryDTO>>> {
  try {
    await requirePermission("orders:view");
  } catch {
    return fail<PaginatedResult<DeliveryChallanSummaryDTO>>(
      "FORBIDDEN",
      "rbac.noAccess",
    );
  }

  const parsed = listDeliveryChallansSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const {
    page,
    pageSize,
    search,
    orderId,
    dealerCode,
    status,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
  } = parsed.data;

  const where: Prisma.DeliveryChallanWhereInput = {};

  if (status) {
    where.status = status;
  }
  if (orderId) {
    where.orderId = orderId;
  }
  if (dealerCode) {
    where.dealerCode = dealerCode;
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
      { challanNo: { contains: search, mode: "insensitive" } },
      { order: { orderNo: { contains: search, mode: "insensitive" } } },
      { dealer: { companyName: { contains: search, mode: "insensitive" } } },
    ];
  }

  try {
    const [total, challans] = await prisma.$transaction([
      prisma.deliveryChallan.count({ where }),
      prisma.deliveryChallan.findMany({
        where,
        include: challanSummaryInclude,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return ok({
      items: challans.map(toChallanSummaryDTO),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize) || 1,
    });
  } catch (error) {
    return fromPrismaError(error);
  }
}
