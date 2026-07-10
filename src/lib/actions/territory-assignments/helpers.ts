import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import type {
  ActionResult,
  FieldError,
  TerritoryAssignmentError,
  TerritoryAssignmentErrorCode,
} from "@/lib/rbac/territory/territory-types";

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(
  code: TerritoryAssignmentErrorCode,
  messageKey: string,
  fieldErrors?: FieldError[],
): ActionResult<T> {
  const error: TerritoryAssignmentError = { code, messageKey };
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

export function fromPrismaError<T>(error: unknown): ActionResult<T> {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2025":
        return fail<T>("ASSIGNMENT_NOT_FOUND", "territoryAssignment.error.notFound");
      default:
        break;
    }
  }
  return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
}
