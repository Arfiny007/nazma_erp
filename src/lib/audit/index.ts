/**
 * Enterprise Audit Console — public surface (PHASE_09D).
 *
 * Read-only operational observability over persisted audit logs.
 *
 * @see ADR-046
 */

export { getAuditConsoleData } from "./audit-service";

export {
  buildAuditExportPayload,
  flattenMetadataSummary,
  MAX_AUDIT_EXPORT_BATCH,
  AuditExportEmptyError,
  AuditExportSizeLimitError,
} from "./export";

export {
  buildAuditWhereClause,
  countAuditLogs,
  findAuditLogs,
  findAuditLogsForSummary,
  filterRowsForRole,
  CATEGORY_ACTION_GROUPS,
  type AuditLogRow,
  type AuditReadClient,
} from "./audit-query";

export {
  mapAuditLogRow,
  buildAuditSummary,
  buildEmptyAuditSummary,
  groupAuditTimeline,
  extractAuditMetadata,
} from "./audit-mappers";

export {
  assertAuditRole,
  assertScopedAuditAccess,
  buildAuditContext,
  normalizeAuditFilters,
  classifyAuditAction,
  categoryMatchesRole,
  resolveAllowedCategories,
  DEFAULT_AUDIT_PAGE_SIZE,
  MAX_AUDIT_PAGE_SIZE,
  FINANCIAL_AUDIT_ACTIONS,
  DEALER_AUDIT_ACTIONS,
  SECURITY_AUDIT_ACTIONS,
  INTEGRITY_AUDIT_ACTIONS,
} from "./audit-validation";

export {
  AuditError,
  EmptyAuditScopeError,
  UnsupportedAuditRoleError,
} from "./audit-errors";

export type {
  AuditRecord,
  AuditFilters,
  AuditCategory,
  AuditRole,
  AuditSummary,
  AuditTimelineGroup,
  AuditTimelineGroupKey,
  AuditQueryResult,
  AuditQueryOptions,
  AuditContext,
} from "./audit-types";
