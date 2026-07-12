import type {
  AuditFilters,
  AuditQueryResult,
  AuditRecord,
  AuditSummary,
  AuditTimelineGroup,
} from "@/lib/audit";

export type ActionResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: {
        code: AuditActionErrorCode;
        messageKey: string;
      };
    };

export type AuditActionErrorCode =
  | "FORBIDDEN"
  | "EMPTY_SCOPE"
  | "UNSUPPORTED_ROLE"
  | "EXPORT_SIZE_LIMIT"
  | "EXPORT_EMPTY"
  | "INTERNAL_ERROR";

export type AuditConsoleDTO = AuditQueryResult;

export interface AuditExportFileDTO {
  filename: string;
  contentType: string;
  data: string;
  recordCount: number;
}

export type {
  AuditFilters,
  AuditRecord,
  AuditSummary,
  AuditTimelineGroup,
};
