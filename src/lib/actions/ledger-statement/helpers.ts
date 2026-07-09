import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import {
  DealerNotFoundError,
  DealerStatementError,
  InvalidDateRangeError,
  InvalidPaginationError,
} from "@/lib/ledger/statement";
import type {
  ActionResult,
  FieldError,
  LedgerStatementError,
  LedgerStatementErrorCode,
} from "@/types/ledger-statement";

/**
 * Internal helpers shared by the Ledger Statement server actions —
 * PHASE_07D1. Mirrors the `ok`/`fail`/`fromZodError` pattern used by
 * `opening-balance/helpers.ts` for consistency across modules.
 */

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(
  code: LedgerStatementErrorCode,
  messageKey: string,
  fieldErrors?: FieldError[],
): ActionResult<T> {
  const error: LedgerStatementError = { code, messageKey };
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

/** Maps errors raised by `src/lib/ledger/statement/` (or Prisma) to an `ActionResult`. */
export function fromStatementError<T>(error: unknown): ActionResult<T> {
  if (error instanceof DealerNotFoundError) {
    return fail<T>("DEALER_NOT_FOUND", "ledgerStatement.error.dealerNotFound");
  }
  if (error instanceof InvalidDateRangeError) {
    return fail<T>("INVALID_DATE_RANGE", "ledgerStatement.error.invalidDateRange");
  }
  if (error instanceof InvalidPaginationError) {
    return fail<T>("INVALID_PAGINATION", "ledgerStatement.error.invalidPagination");
  }
  if (error instanceof DealerStatementError) {
    return fail<T>("VALIDATION_ERROR", "ledgerStatement.error.generic");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
  }
  return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
}
