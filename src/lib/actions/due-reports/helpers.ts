import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import {
  DealerDueNotFoundError,
  DueReportError,
} from "@/lib/reports/due";
import type {
  ActionResult,
  DueReportActionError,
  DueReportErrorCode,
  FieldError,
} from "@/types/due-report";

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(
  code: DueReportErrorCode,
  messageKey: string,
  fieldErrors?: FieldError[],
): ActionResult<T> {
  const error: DueReportActionError = { code, messageKey };
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

export function fromDueReportError<T>(error: unknown): ActionResult<T> {
  if (error instanceof DealerDueNotFoundError) {
    return fail<T>("DEALER_NOT_FOUND", "dueReport.error.dealerNotFound");
  }
  if (error instanceof DueReportError) {
    if (error.code === "INVALID_DATE_RANGE") {
      return fail<T>("INVALID_DATE_RANGE", "dueReport.error.invalidDateRange");
    }
    if (error.code === "INVALID_PAGINATION") {
      return fail<T>("INVALID_PAGINATION", "dueReport.error.invalidPagination");
    }
    if (error.code === "INVALID_BALANCE_RANGE") {
      return fail<T>("INVALID_BALANCE_RANGE", "dueReport.error.invalidBalanceRange");
    }
    return fail<T>("VALIDATION_ERROR", "dueReport.error.generic");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
  }
  return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
}

export function parseOptionalDecimal(value?: string): Prisma.Decimal | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  return new Prisma.Decimal(value);
}
