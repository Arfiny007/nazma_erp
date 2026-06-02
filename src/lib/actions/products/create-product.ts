"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { createProductSchema } from "@/lib/validators/product.schema";
import type { ActionResult, ProductDTO } from "@/types/product";

import {
  fail,
  fromPrismaError,
  fromZodError,
  ok,
  toProductDTO,
} from "./helpers";

/**
 * Creates a new product.
 *
 * The owning category must exist and both `sku` and `modelNumber` must be
 * unique. Uniqueness is checked inside the transaction for precise field-level
 * errors; the database unique constraints remain the final guard against
 * concurrent inserts and are surfaced via `fromPrismaError`.
 */
export async function createProduct(
  input: unknown,
): Promise<ActionResult<ProductDTO>> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const data = parsed.data;

  try {
    const product = await prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id: data.categoryId },
        select: { id: true },
      });
      if (!category) {
        throw new CategoryNotFoundError();
      }

      const existingSku = await tx.product.findUnique({
        where: { sku: data.sku },
        select: { id: true },
      });
      if (existingSku) {
        throw new DuplicateSkuError();
      }

      const existingModelNumber = await tx.product.findUnique({
        where: { modelNumber: data.modelNumber },
        select: { id: true },
      });
      if (existingModelNumber) {
        throw new DuplicateModelNumberError();
      }

      return tx.product.create({
        data: {
          sku: data.sku,
          modelNumber: data.modelNumber,
          name: data.name,
          nameBn: data.nameBn,
          categoryId: data.categoryId,
          unit: data.unit,
          description: data.description,
          currentPrice: data.currentPrice,
          isActive: data.isActive,
        },
        include: { category: true },
      });
    });

    revalidatePath("/products");
    return ok(toProductDTO(product));
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      return fail<ProductDTO>("CATEGORY_NOT_FOUND", "product.error.categoryNotFound", [
        { field: "categoryId", messageKey: "product.error.categoryNotFound" },
      ]);
    }
    if (error instanceof DuplicateSkuError) {
      return fail<ProductDTO>("DUPLICATE_SKU", "product.error.duplicateSku", [
        { field: "sku", messageKey: "product.error.duplicateSku" },
      ]);
    }
    if (error instanceof DuplicateModelNumberError) {
      return fail<ProductDTO>(
        "DUPLICATE_MODEL_NUMBER",
        "product.error.duplicateModelNumber",
        [
          {
            field: "modelNumber",
            messageKey: "product.error.duplicateModelNumber",
          },
        ],
      );
    }
    return fromPrismaError(error);
  }
}

/** Sentinel surfaced when the referenced category does not exist. */
class CategoryNotFoundError extends Error {
  constructor() {
    super("CATEGORY_NOT_FOUND");
    this.name = "CategoryNotFoundError";
  }
}

/** Sentinel surfaced when the SKU is already taken. */
class DuplicateSkuError extends Error {
  constructor() {
    super("DUPLICATE_SKU");
    this.name = "DuplicateSkuError";
  }
}

/** Sentinel surfaced when the model number is already taken. */
class DuplicateModelNumberError extends Error {
  constructor() {
    super("DUPLICATE_MODEL_NUMBER");
    this.name = "DuplicateModelNumberError";
  }
}
