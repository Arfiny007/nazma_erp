/**
 * Enterprise Audit Export — public surface (PHASE_09E).
 *
 * Read-only compliance exports over {@link getAuditConsoleData} only.
 *
 * @see ADR-048
 */

export {
  buildAuditExportPayload,
  createAuditArchiveExport,
  createAuditExcelExport,
  createAuditHtmlExport,
  createAuditPdfExport,
  generateAuditArchiveBuffer,
  generateAuditExcelBuffer,
  generateAuditPdfBuffer,
} from "./audit-export-service";

export {
  buildAuditReportHtml,
  buildCategoryCounts,
  buildComplianceSummary,
  describeAppliedFilters,
  flattenMetadataSummary,
  mapRecordsToExcelRows,
  resolveTerritoryLabel,
} from "./audit-export-mappers";

export {
  assertExportWithinLimit,
  buildAuditArchiveFilename,
  buildAuditExcelFilename,
  buildAuditPdfFilename,
  normalizeExportFilters,
} from "./audit-export-validation";

export {
  AuditExportEmptyError,
  AuditExportError,
  AuditExportSizeLimitError,
} from "./audit-export-errors";

export {
  MAX_AUDIT_EXPORT_BATCH,
} from "./audit-export-types";

export type {
  AuditComplianceSummary,
  AuditExcelRow,
  AuditExportActor,
  AuditExportFile,
  AuditExportFormat,
  AuditExportPayload,
} from "./audit-export-types";
