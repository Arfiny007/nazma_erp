import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import {
  EmptyTerritoryScopeError,
  ProductSalesError,
  TerritoryOutOfScopeError,
} from "@/lib/reports/product-sales-territory";
import type {
  ActionResult,
  FieldError,
  ProductSalesActionError,
  ProductSalesErrorCode,
} from "@/types/product-sales-territory";

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(
  code: ProductSalesErrorCode,
  messageKey: string,
  fieldErrors?: FieldError[],
): ActionResult<T> {
  const error: ProductSalesActionError = { code, messageKey };
  if (fieldErrors && fieldErrors.length > 0) {
    error.fieldErrors = fieldErrors;
  }
  return { success: false, error };
}

export function fromZodError<T>(error: ZodError): ActionResult<T> {
  const fieldErrors: FieldError[] = error.issues.map((issue) => ({
    field: issue.path.map((segment) => String(segment)).join(".") || "_root",
    messageKey: issue.message,
  }));
  return fail<T>("VALIDATION_ERROR", "validation.failed", fieldErrors);
}

export function fromProductSalesError<T>(error: unknown): ActionResult<T> {
  if (error instanceof EmptyTerritoryScopeError) {
    return fail<T>(
      "EMPTY_TERRITORY_SCOPE",
      "productSales.error.emptyTerritoryScope",
    );
  }
  if (error instanceof TerritoryOutOfScopeError) {
    return fail<T>(
      "TERRITORY_OUT_OF_SCOPE",
      "productSales.error.territoryOutOfScope",
    );
  }
  if (error instanceof ProductSalesError) {
    if (error.code === "INVALID_DATE_RANGE") {
      return fail<T>(
        "INVALID_DATE_RANGE",
        "productSales.error.invalidDateRange",
      );
    }
    if (error.code === "INVALID_PAGINATION") {
      return fail<T>(
        "INVALID_PAGINATION",
        "productSales.error.invalidPagination",
      );
    }
    return fail<T>("VALIDATION_ERROR", "productSales.error.generic");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
  }
  return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
}
