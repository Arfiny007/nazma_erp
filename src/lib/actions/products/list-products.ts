"use server";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { listProductsSchema } from "@/lib/validators/product.schema";
import type {
  ActionResult,
  PaginatedResult,
  ProductDTO,
} from "@/types/product";

import { fromPrismaError, fromZodError, ok, toProductDTO } from "./helpers";

/**
 * Returns a paginated, filterable, sortable list of products.
 *
 * Supports free-text search across SKU, model number and names, plus category
 * and active filters. Count and page query run in a single read transaction so
 * totals stay consistent with the returned page. The owning category is
 * eagerly included.
 */
export async function listProducts(
  input: unknown = {},
): Promise<ActionResult<PaginatedResult<ProductDTO>>> {
  const parsed = listProductsSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { page, pageSize, search, categoryId, isActive, sortBy, sortOrder } =
    parsed.data;

  const where: Prisma.ProductWhereInput = {};

  if (typeof isActive === "boolean") {
    where.isActive = isActive;
  }
  if (categoryId) {
    where.categoryId = categoryId;
  }
  if (search) {
    where.OR = [
      { sku: { contains: search, mode: "insensitive" } },
      { modelNumber: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { nameBn: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const [total, products] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: true },
      }),
    ]);

    const pageCount = total === 0 ? 0 : Math.ceil(total / pageSize);

    return ok({
      items: products.map(toProductDTO),
      total,
      page,
      pageSize,
      pageCount,
    });
  } catch (error) {
    return fromPrismaError(error);
  }
}
