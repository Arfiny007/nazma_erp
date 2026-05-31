import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import { calculateCreditUtilization } from "@/lib/utils/credit-limit";
import type {
  ActionResult,
  DealerDTO,
  DealerError,
  DealerErrorCode,
  DealerRecord,
  FieldError,
} from "@/types/dealer";

/**
 * Internal (non-action) helpers shared by the dealer server actions: result
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
  code: DealerErrorCode,
  messageKey: string,
  fieldErrors?: FieldError[],
): ActionResult<T> {
  const error: DealerError = { code, messageKey };
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
        if (target.includes("mobile")) {
          return fail<T>("DUPLICATE_MOBILE", "dealer.error.duplicateMobile", [
            { field: "mobile", messageKey: "dealer.error.duplicateMobile" },
          ]);
        }
        return fail<T>(
          "DUPLICATE_DEALER_CODE",
          "dealer.error.duplicateCode",
        );
      }
      case "P2003":
        return fail<T>(
          "DEALER_HAS_DEPENDENCIES",
          "dealer.error.hasDependencies",
        );
      case "P2025":
        return fail<T>("DEALER_NOT_FOUND", "dealer.error.notFound");
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

/** Serializes a persisted dealer record into a transport-safe DTO. */
export function toDealerDTO(dealer: DealerRecord): DealerDTO {
  return {
    id: dealer.id,
    dealerCode: dealer.dealerCode,
    companyName: dealer.companyName,
    proprietorName: dealer.proprietorName,
    mobile: dealer.mobile,
    email: dealer.email,
    address: dealer.address,
    district: dealer.district,
    territory: dealer.territory,
    creditLimit: dealer.creditLimit.toFixed(2),
    currentBalance: dealer.currentBalance.toFixed(2),
    isActive: dealer.isActive,
    createdAt: dealer.createdAt.toISOString(),
    updatedAt: dealer.updatedAt.toISOString(),
    credit: calculateCreditUtilization(
      dealer.creditLimit,
      dealer.currentBalance,
    ),
  };
}
