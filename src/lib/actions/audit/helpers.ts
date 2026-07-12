import {
  AuditError,
  AuditExportEmptyError,
  AuditExportSizeLimitError,
  EmptyAuditScopeError,
  UnsupportedAuditRoleError,
} from "@/lib/audit";
import type { ActionResult, AuditActionErrorCode, AuditConsoleDTO } from "@/types/audit";

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(
  code: AuditActionErrorCode,
  messageKey: string,
): ActionResult<T> {
  return { success: false, error: { code, messageKey } };
}

export function fromAuditError<T>(error: unknown): ActionResult<T> {
  if (error instanceof EmptyAuditScopeError) {
    return fail<T>("EMPTY_SCOPE", "audit.error.emptyScope");
  }
  if (error instanceof UnsupportedAuditRoleError) {
    return fail<T>("UNSUPPORTED_ROLE", "audit.error.unsupportedRole");
  }
  if (error instanceof AuditExportSizeLimitError) {
    return fail<T>("EXPORT_SIZE_LIMIT", "audit.export.error.sizeLimit");
  }
  if (error instanceof AuditExportEmptyError) {
    return fail<T>("EXPORT_EMPTY", "audit.export.error.empty");
  }
  if (error instanceof AuditError) {
    return fail<T>("INTERNAL_ERROR", "audit.error.generic");
  }
  return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
}

export function toAuditConsoleDTO(payload: AuditConsoleDTO): AuditConsoleDTO {
  return payload;
}
