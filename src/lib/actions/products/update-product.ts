"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/rbac/guards";
import { prisma } from "@/lib/prisma";
import { updateProductSchema } from "@/lib/validators/product.schema";
import type { ActionResult, ProductDTO } from "@/types/product";

import {
  fail,
  fromPrismaError,
  fromZodError,
  ok,
  toProductDTO,
} from "./helpers";

/**
 * Updates an existing product's editable fields.
 *
 * Only fields present in the input are modified. When `sku` or `modelNumber`
 * change they are re-checked for uniqueness, and a changed `categoryId` is
 * verified to reference an existing category.
 */
export async function updateProduct(
  input: unknown,
): Promise<ActionResult<ProductDTO>> {
  try {
    await requirePermission("products:edit");
  } catch {
    return fail<ProductDTO>("INTERNAL_ERROR", "rbac.noAccess");
  }

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id, ...changes } = parsed.data;

  try {
    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id },
        select: { id: true, sku: true, modelNumber: true },
      });
      if (!existing) {
        throw new ProductNotFoundError();
      }

      if (changes.sku !== undefined && changes.sku !== existing.sku) {
        const skuOwner = await tx.product.findFirst({
          where: { sku: changes.sku, id: { not: id } },
          select: { id: true },
        });
        if (skuOwner) {
          throw new DuplicateSkuError();
        }
      }

      if (
        changes.modelNumber !== undefined &&
        changes.modelNumber !== existing.modelNumber
      ) {
        const modelOwner = await tx.product.findFirst({
          where: { modelNumber: changes.modelNumber, id: { not: id } },
          select: { id: true },
        });
        if (modelOwner) {
          throw new DuplicateModelNumberError();
        }
      }

      if (changes.categoryId !== undefined) {
        const category = await tx.category.findUnique({
          where: { id: changes.categoryId },
          select: { id: true },
        });
        if (!category) {
          throw new CategoryNotFoundError();
        }
      }

      const updateData: Prisma.ProductUncheckedUpdateInput = {};
      if (changes.sku !== undefined) {
        updateData.sku = changes.sku;
      }
      if (changes.modelNumber !== undefined) {
        updateData.modelNumber = changes.modelNumber;
      }
      if (changes.name !== undefined) {
        updateData.name = changes.name;
      }
      if (changes.nameBn !== undefined) {
        updateData.nameBn = changes.nameBn;
      }
      if (changes.categoryId !== undefined) {
        updateData.categoryId = changes.categoryId;
      }
      if (changes.unit !== undefined) {
        updateData.unit = changes.unit;
      }
      if (changes.description !== undefined) {
        updateData.description = changes.description;
      }
      if (changes.currentPrice !== undefined) {
        updateData.currentPrice = changes.currentPrice;
      }
      if (changes.isActive !== undefined) {
        updateData.isActive = changes.isActive;
      }

      return tx.product.update({
        where: { id },
        data: updateData,
        include: { category: true },
      });
    });

    revalidatePath("/products");
    revalidatePath(`/products/${product.id}`);
    return ok(toProductDTO(product));
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      return fail<ProductDTO>("PRODUCT_NOT_FOUND", "product.error.notFound");
    }
    if (error instanceof CategoryNotFoundError) {
      return fail<ProductDTO>(
        "CATEGORY_NOT_FOUND",
        "product.error.categoryNotFound",
        [{ field: "categoryId", messageKey: "product.error.categoryNotFound" }],
      );
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

class ProductNotFoundError extends Error {
  constructor() {
    super("PRODUCT_NOT_FOUND");
    this.name = "ProductNotFoundError";
  }
}

class CategoryNotFoundError extends Error {
  constructor() {
    super("CATEGORY_NOT_FOUND");
    this.name = "CategoryNotFoundError";
  }
}

class DuplicateSkuError extends Error {
  constructor() {
    super("DUPLICATE_SKU");
    this.name = "DuplicateSkuError";
  }
}

class DuplicateModelNumberError extends Error {
  constructor() {
    super("DUPLICATE_MODEL_NUMBER");
    this.name = "DuplicateModelNumberError";
  }
}
