import type { ZodError } from "zod";

import {
  NotificationError,
  NotificationLifecycleError,
  NotificationNotFoundError,
  NotificationRetryExhaustedError,
  NotificationValidationError,
} from "@/lib/notifications";
import type {
  ActionResult,
  NotificationActionErrorCode,
  NotificationFieldError,
} from "@/types/notification";

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(
  code: NotificationActionErrorCode,
  messageKey: string,
  fieldErrors?: NotificationFieldError[],
): ActionResult<T> {
  if (fieldErrors && fieldErrors.length > 0) {
    return {
      success: false,
      error: { code, messageKey, fieldErrors },
    };
  }
  return { success: false, error: { code, messageKey } };
}

export function fromZodError<T>(error: ZodError): ActionResult<T> {
  const fieldErrors: NotificationFieldError[] = error.issues.map((issue) => ({
    field: issue.path.map((segment) => String(segment)).join(".") || "_root",
    messageKey: issue.message,
  }));
  return fail<T>("VALIDATION_ERROR", "validation.failed", fieldErrors);
}

export function fromDomainError<T>(error: unknown): ActionResult<T> {
  if (error instanceof NotificationNotFoundError) {
    return fail("NOT_FOUND", "notifications.error.notFound");
  }
  if (error instanceof NotificationLifecycleError) {
    return fail("INVALID_TRANSITION", "notifications.error.invalidTransition");
  }
  if (error instanceof NotificationRetryExhaustedError) {
    return fail("RETRY_EXHAUSTED", "notifications.error.retryExhausted");
  }
  if (error instanceof NotificationValidationError) {
    return fail("VALIDATION_ERROR", "notifications.error.validation");
  }
  if (error instanceof NotificationError) {
    return fail("INTERNAL_ERROR", "notifications.error.unexpected");
  }
  return fail("INTERNAL_ERROR", "common.error.unexpected");
}
