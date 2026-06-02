"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types/product";

import { fail, fromPrismaError, fromZodError, ok } from "./helpers";

const deleteProductSchema = z.object({
  id: z.uuid({ error: "validation.id.invalid" }),
});

export interface DeleteProductResult {
  id: string;
  sku: string;
  modelNumber: string;
}

/**
 * Permanently deletes a product.
 *
 * To preserve order history integrity, a product is only removed when it has no
 * dependent order items. When dependencies exist the caller receives a typed
 * PRODUCT_HAS_DEPENDENCIES error and should deactivate the product instead.
 */
export async function deleteProduct(
  input: unknown,
): Promise<ActionResult<DeleteProductResult>> {
  const parsed = deleteProductSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
        select: { id: true, sku: true, modelNumber: true },
      });
      if (!product) {
        throw new ProductNotFoundError();
      }

      const orderItems = await tx.salesOrderItem.count({
        where: { productId: id },
      });
      if (orderItems > 0) {
        throw new ProductHasDependenciesError();
      }

      await tx.product.delete({ where: { id } });
      return {
        id: product.id,
        sku: product.sku,
        modelNumber: product.modelNumber,
      };
    });

    revalidatePath("/products");
    return ok(result);
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      return fail<DeleteProductResult>(
        "PRODUCT_NOT_FOUND",
        "product.error.notFound",
      );
    }
    if (error instanceof ProductHasDependenciesError) {
      return fail<DeleteProductResult>(
        "PRODUCT_HAS_DEPENDENCIES",
        "product.error.hasDependencies",
      );
    }
    return fromPrismaError(error);
  }
}

class ProductNotFoundError extends Error {
  constructor() {
    super("PRODUCT_NOT_FOUND");
    this.name = "ProductNotFoundError";
  }
}

class ProductHasDependenciesError extends Error {
  constructor() {
    super("PRODUCT_HAS_DEPENDENCIES");
    this.name = "ProductHasDependenciesError";
  }
}
