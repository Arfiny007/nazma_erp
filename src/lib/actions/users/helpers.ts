import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import type {
  ActionResult,
  FieldError,
  UserManagementError,
  UserManagementErrorCode,
} from "@/types/user-management";
import {
  UserEmailExistsError,
  UserLifecycleError,
  UserManagementError as UserDomainError,
  UserNotFoundError,
  UserScopeDeniedError,
  RoleEscalationError,
} from "@/lib/users/user-errors";

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(
  code: UserManagementErrorCode,
  messageKey: string,
  fieldErrors?: FieldError[],
): ActionResult<T> {
  const error: UserManagementError = { code, messageKey };
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

export function fromDomainError<T>(error: unknown): ActionResult<T> {
  if (error instanceof UserEmailExistsError) {
    return fail("EMAIL_EXISTS", "userManagement.error.emailExists");
  }
  if (error instanceof UserNotFoundError) {
    return fail("NOT_FOUND", "userManagement.error.notFound");
  }
  if (error instanceof UserLifecycleError) {
    return fail("INVALID_TRANSITION", "userManagement.error.invalidTransition");
  }
  if (error instanceof RoleEscalationError) {
    return fail("ROLE_ESCALATION", "userManagement.error.roleEscalation");
  }
  if (error instanceof UserScopeDeniedError) {
    return fail("FORBIDDEN", "rbac.noAccess");
  }
  if (error instanceof UserDomainError) {
    return fail(error.code as UserManagementErrorCode, "userManagement.error.unexpected");
  }
  return fromPrismaError(error);
}

export function fromPrismaError<T>(error: unknown): ActionResult<T> {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return fail("EMAIL_EXISTS", "userManagement.error.emailExists");
    }
    if (error.code === "P2025") {
      return fail("NOT_FOUND", "userManagement.error.notFound");
    }
  }
  return fail("INTERNAL_ERROR", "common.error.unexpected");
}
