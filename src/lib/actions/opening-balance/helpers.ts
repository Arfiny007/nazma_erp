import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import { OpeningBalanceError } from "@/lib/finance/initialization/opening-balance-errors";
import type {
  ActionResult,
  OpeningBalanceError as OpeningBalanceErrorDTO,
  OpeningBalanceErrorCode,
  OpeningBalanceFieldError,
} from "@/types/opening-balance";

/**
 * Internal helpers shared by Opening Balance server actions.
 */

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(
  code: OpeningBalanceErrorCode,
  messageKey: string,
  fieldErrors?: OpeningBalanceFieldError[],
): ActionResult<T> {
  const error: OpeningBalanceErrorDTO = { code, messageKey };
  if (fieldErrors && fieldErrors.length > 0) {
    error.fieldErrors = fieldErrors;
  }
  return { success: false, error };
}

export function fromZodError<T>(error: ZodError): ActionResult<T> {
  const fieldErrors: OpeningBalanceFieldError[] = error.issues.map((issue) => ({
    field: issue.path.map((segment) => String(segment)).join(".") || "_root",
    messageKey: issue.message,
  }));
  return fail<T>("VALIDATION_ERROR", "validation.failed", fieldErrors);
}

export function fromOpeningBalanceError<T>(
  error: OpeningBalanceError,
): ActionResult<T> {
  return fail<T>(error.code, error.messageKey);
}

export function fromPrismaError<T>(error: unknown): ActionResult<T> {
  if (error instanceof OpeningBalanceError) {
    return fromOpeningBalanceError<T>(error);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2025":
        return fail<T>("RECORD_NOT_FOUND", "openingBalance.error.notFound");
      case "P2003":
        return fail<T>("DEALER_NOT_FOUND", "openingBalance.error.dealerNotFound");
      default:
        break;
    }
  }
  return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
}
