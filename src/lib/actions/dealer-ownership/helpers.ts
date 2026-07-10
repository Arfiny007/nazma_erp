import type { ZodError } from "zod";

import {
  ActiveOwnershipConflictError,
  DealerNotFoundError,
  OwnershipConflictError,
  TerritoryNotAssignableError,
  TerritoryNotFoundError,
} from "@/lib/dealers/ownership";
import type {
  OwnershipActionError,
  OwnershipActionResult,
  OwnershipErrorCode,
} from "@/lib/dealers/ownership/ownership-types";

export function ok<T>(data: T): OwnershipActionResult<T> {
  return { success: true, data };
}

export function fail<T>(
  code: OwnershipErrorCode,
  messageKey: string,
  fieldErrors?: { field: string; messageKey: string }[],
): OwnershipActionResult<T> {
  const error: OwnershipActionError = { code, messageKey };
  if (fieldErrors?.length) {
    error.fieldErrors = fieldErrors;
  }
  return { success: false, error };
}

export function fromZodError<T>(error: ZodError): OwnershipActionResult<T> {
  return fail(
    "VALIDATION_ERROR",
    "validation.failed",
    error.issues.map((issue) => ({
      field: issue.path.join(".") || "_root",
      messageKey: issue.message,
    })),
  );
}

export function fromOwnershipError<T>(error: unknown): OwnershipActionResult<T> {
  if (error instanceof DealerNotFoundError) {
    return fail("DEALER_NOT_FOUND", "dealer.error.notFound");
  }
  if (error instanceof TerritoryNotFoundError) {
    return fail("TERRITORY_NOT_FOUND", "dealer.ownership.error.territoryNotFound");
  }
  if (error instanceof TerritoryNotAssignableError) {
    return fail("TERRITORY_NOT_ASSIGNABLE", "rbac.territory.noAccess");
  }
  if (error instanceof ActiveOwnershipConflictError) {
    return fail("ACTIVE_OWNERSHIP_EXISTS", "dealer.ownership.error.activeExists");
  }
  if (error instanceof OwnershipConflictError) {
    return fail("OWNERSHIP_CONFLICT", "dealer.ownership.error.conflict");
  }
  return fail("INTERNAL_ERROR", "common.error.unexpected");
}
