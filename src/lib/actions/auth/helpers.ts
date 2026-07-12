import type { ZodError } from "zod";

import {
  ActivationNotAllowedError,
  AuthTokenError,
  PasswordMismatchError,
  TokenExpiredError,
  TokenInvalidError,
  TokenReplayError,
} from "@/lib/users/auth-errors";
import type {
  AuthActionError,
  AuthActionResult,
  AuthErrorCode,
  AuthFieldError,
} from "@/types/authentication";

export function authOk<T>(data: T): AuthActionResult<T> {
  return { success: true, data };
}

export function authFail<T>(
  code: AuthErrorCode,
  messageKey: string,
  fieldErrors?: AuthFieldError[],
): AuthActionResult<T> {
  const error: AuthActionError = { code, messageKey };
  if (fieldErrors && fieldErrors.length > 0) {
    error.fieldErrors = fieldErrors;
  }
  return { success: false, error };
}

export function fromAuthZodError<T>(error: ZodError): AuthActionResult<T> {
  const fieldErrors: AuthFieldError[] = error.issues.map((issue) => ({
    field: issue.path.map((segment) => String(segment)).join(".") || "_root",
    messageKey: issue.message,
  }));
  return authFail<T>("VALIDATION_ERROR", "validation.failed", fieldErrors);
}

export function fromAuthDomainError<T>(error: unknown): AuthActionResult<T> {
  if (error instanceof TokenInvalidError) {
    return authFail("TOKEN_INVALID", "auth.error.tokenInvalid");
  }
  if (error instanceof TokenExpiredError) {
    return authFail("TOKEN_EXPIRED", "auth.error.tokenExpired");
  }
  if (error instanceof TokenReplayError) {
    return authFail("TOKEN_REPLAY", "auth.error.tokenReplay");
  }
  if (error instanceof PasswordMismatchError) {
    return authFail("PASSWORD_MISMATCH", "auth.error.currentPasswordInvalid");
  }
  if (error instanceof ActivationNotAllowedError) {
    return authFail("ACTIVATION_NOT_ALLOWED", "auth.error.activationNotAllowed");
  }
  if (error instanceof AuthTokenError) {
    return authFail("INTERNAL_ERROR", "auth.error.unknown");
  }
  if (error instanceof Error && error.message === "Unauthorized: authentication required") {
    return authFail("UNAUTHORIZED", "auth.error.unauthorized");
  }
  return authFail("INTERNAL_ERROR", "common.error.unexpected");
}
