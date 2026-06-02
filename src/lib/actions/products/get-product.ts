"use server";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { productIdentifierSchema } from "@/lib/validators/product.schema";
import type { ActionResult, ProductDTO } from "@/types/product";

import { fail, fromPrismaError, fromZodError, ok, toProductDTO } from "./helpers";

/**
 * Fetches a single product by `id`, `sku`, or `modelNumber`.
 *
 * At least one identifier is required; precedence is `id`, then `sku`, then
 * `modelNumber`. The owning category is eagerly included.
 */
export async function getProduct(
  input: unknown,
): Promise<ActionResult<ProductDTO>> {
  const parsed = productIdentifierSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id, sku, modelNumber } = parsed.data;

  let where: Prisma.ProductWhereUniqueInput;
  if (id) {
    where = { id };
  } else if (sku) {
    where = { sku };
  } else {
    where = { modelNumber: modelNumber! };
  }

  try {
    const product = await prisma.product.findUnique({
      where,
      include: { category: true },
    });

    if (!product) {
      return fail<ProductDTO>("PRODUCT_NOT_FOUND", "product.error.notFound");
    }

    return ok(toProductDTO(product));
  } catch (error) {
    return fromPrismaError(error);
  }
}
