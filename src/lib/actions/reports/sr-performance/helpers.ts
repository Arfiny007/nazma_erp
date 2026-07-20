import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import {
  EmptyTerritoryScopeError,
  SrOutOfScopeError,
  SrPerformanceError,
  TerritoryOutOfScopeError,
} from "@/lib/reports/sr-performance";
import type {
  ActionResult,
  FieldError,
  SrPerformanceActionError,
  SrPerformanceErrorCode,
} from "@/types/sr-performance";

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(
  code: SrPerformanceErrorCode,
  messageKey: string,
  fieldErrors?: FieldError[],
): ActionResult<T> {
  const error: SrPerformanceActionError = { code, messageKey };
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

export function fromSrPerformanceError<T>(error: unknown): ActionResult<T> {
  if (error instanceof EmptyTerritoryScopeError) {
    return fail<T>("EMPTY_TERRITORY_SCOPE", "srPerformance.error.emptyTerritoryScope");
  }
  if (error instanceof SrOutOfScopeError) {
    return fail<T>("SR_OUT_OF_SCOPE", "srPerformance.error.srOutOfScope");
  }
  if (error instanceof TerritoryOutOfScopeError) {
    return fail<T>("TERRITORY_OUT_OF_SCOPE", "srPerformance.error.territoryOutOfScope");
  }
  if (error instanceof SrPerformanceError) {
    if (error.code === "INVALID_DATE_RANGE") {
      return fail<T>("INVALID_DATE_RANGE", "srPerformance.error.invalidDateRange");
    }
    if (error.code === "INVALID_PAGINATION") {
      return fail<T>("INVALID_PAGINATION", "srPerformance.error.invalidPagination");
    }
    if (error.code === "REPORT_CAP_EXCEEDED") {
      return fail<T>("REPORT_CAP_EXCEEDED", "srPerformance.error.reportCapExceeded");
    }
    if (error.message.includes("authorized srId")) {
      return fail<T>("VALIDATION_ERROR", "srPerformance.error.individualPrintRequiresSr");
    }
    if (error.message.includes("Print mode")) {
      return fail<T>("VALIDATION_ERROR", "srPerformance.error.printModeRequired");
    }
    return fail<T>("VALIDATION_ERROR", "srPerformance.error.generic");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
  }
  return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
}
