"use server";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import {
  buildTerritoryScope,
  canAccessCollection,
  mergeCollectionTerritoryScope,
} from "@/lib/rbac/territory";
import { listCollectionsSchema } from "@/lib/validators/collection.schema";
import type {
  ActionResult,
  CollectionListItemDTO,
  PaginatedResult,
} from "@/types/collection";

import {
  collectionListInclude,
  fail,
  fromZodError,
  ok,
  toCollectionListItemDTO,
} from "./helpers";

export async function listCollections(
  input: unknown,
): Promise<ActionResult<PaginatedResult<CollectionListItemDTO>>> {
  let user;
  try {
    user = await requirePermission("collections:view");
  } catch {
    return fail<PaginatedResult<CollectionListItemDTO>>(
      "FORBIDDEN",
      "rbac.noAccess",
    );
  }

  const parsed = listCollectionsSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const {
    page,
    pageSize,
    search,
    dealerCode,
    status,
    paymentMethod,
    dateFrom,
    dateTo,
    isAdvancePayment,
    sortBy,
    sortOrder,
  } = parsed.data;

  const where: Prisma.CollectionWhereInput = {};

  if (dealerCode) {
    where.dealerCode = dealerCode;
  }
  if (status) {
    where.status = status;
  }
  if (paymentMethod) {
    where.paymentMethod = paymentMethod;
  }
  if (isAdvancePayment !== undefined) {
    where.isAdvancePayment = isAdvancePayment;
  }
  if (dateFrom || dateTo) {
    where.collectionDate = {};
    if (dateFrom) {
      where.collectionDate.gte = dateFrom;
    }
    if (dateTo) {
      where.collectionDate.lte = dateTo;
    }
  }
  if (search) {
    where.OR = [
      { collectionNo: { contains: search, mode: "insensitive" } },
      { dealer: { companyName: { contains: search, mode: "insensitive" } } },
      { dealerCode: { contains: search, mode: "insensitive" } },
      { referenceNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  const scope = await buildTerritoryScope(user.id);
  const scopedWhere = mergeCollectionTerritoryScope(where, scope);

  const orderBy: Prisma.CollectionOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [total, rows] = await prisma.$transaction([
    prisma.collection.count({ where: scopedWhere }),
    prisma.collection.findMany({
      where: scopedWhere,
      include: collectionListInclude,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    items: rows.map(toCollectionListItemDTO),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  });
}
