import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import type {
  ActionResult,
  CategoryDTO,
  CategoryRecord,
  FieldError,
  ProductDTO,
  ProductError,
  ProductErrorCode,
  ProductWithCategory,
} from "@/types/product";

/**
 * Internal (non-action) helpers shared by the product server actions: result
 * envelope constructors, error mapping and serialization. This module is kept
 * separate from the `"use server"` action files, whose exports must all be
 * async functions.
 */

/** Wraps a successful payload in the success branch of {@link ActionResult}. */
export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

/** Builds the failure branch of {@link ActionResult}. */
export function fail<T>(
  code: ProductErrorCode,
  messageKey: string,
  fieldErrors?: FieldError[],
): ActionResult<T> {
  const error: ProductError = { code, messageKey };
  if (fieldErrors && fieldErrors.length > 0) {
    error.fieldErrors = fieldErrors;
  }
  return { success: false, error };
}

/** Converts a {@link ZodError} into a typed VALIDATION_ERROR result. */
export function fromZodError<T>(error: ZodError): ActionResult<T> {
  const fieldErrors: FieldError[] = error.issues.map((issue) => ({
    field: issue.path.map((segment) => String(segment)).join(".") || "_root",
    messageKey: issue.message,
  }));

  return fail<T>("VALIDATION_ERROR", "validation.failed", fieldErrors);
}

/**
 * Maps a thrown Prisma error to a typed result. Unknown errors collapse to a
 * generic INTERNAL_ERROR so raw database details never leak to callers.
 */
export function fromPrismaError<T>(error: unknown): ActionResult<T> {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        const target = normalizeUniqueTarget(error.meta?.target);
        if (target.includes("modelNumber")) {
          return fail<T>(
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
        return fail<T>("DUPLICATE_SKU", "product.error.duplicateSku", [
          { field: "sku", messageKey: "product.error.duplicateSku" },
        ]);
      }
      case "P2003":
        return fail<T>(
          "PRODUCT_HAS_DEPENDENCIES",
          "product.error.hasDependencies",
        );
      case "P2025":
        return fail<T>("PRODUCT_NOT_FOUND", "product.error.notFound");
      default:
        break;
    }
  }

  return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
}

function normalizeUniqueTarget(target: unknown): string[] {
  if (Array.isArray(target)) {
    return target.map((value) => String(value));
  }
  if (typeof target === "string") {
    return [target];
  }
  return [];
}

/** Serializes a persisted category record into a transport-safe DTO. */
export function toCategoryDTO(category: CategoryRecord): CategoryDTO {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

/** Serializes a persisted product record into a transport-safe DTO. */
export function toProductDTO(product: ProductWithCategory): ProductDTO {
  return {
    id: product.id,
    sku: product.sku,
    modelNumber: product.modelNumber,
    name: product.name,
    nameBn: product.nameBn,
    categoryId: product.categoryId,
    unit: product.unit,
    description: product.description,
    currentPrice: product.currentPrice.toFixed(2),
    isActive: product.isActive,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    category: product.category ? toCategoryDTO(product.category) : null,
  };
}
