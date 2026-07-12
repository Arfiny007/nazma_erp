import type { AuditFilters } from "../audit-types";

import { AuditExportSizeLimitError } from "./audit-export-errors";
import { MAX_AUDIT_EXPORT_BATCH } from "./audit-export-types";

/**
 * Normalize filters for export — always page 1 with export batch cap.
 */
export function normalizeExportFilters(filters: AuditFilters): AuditFilters {
  return {
    ...filters,
    page: 1,
    pageSize: MAX_AUDIT_EXPORT_BATCH,
    search: filters.search?.trim() || undefined,
    action: filters.action?.trim() || undefined,
    entityType: filters.entityType?.trim() || undefined,
    role: filters.role?.trim() || undefined,
  };
}

export function assertExportWithinLimit(total: number): void {
  if (total > MAX_AUDIT_EXPORT_BATCH) {
    throw new AuditExportSizeLimitError(total, MAX_AUDIT_EXPORT_BATCH);
  }
}

export function buildAuditArchiveFilename(generatedAt: string): string {
  const date = generatedAt.slice(0, 10);
  return `audit-archive-${date}.zip`;
}

export function buildAuditPdfFilename(generatedAt: string): string {
  const date = generatedAt.slice(0, 10);
  return `audit-report-${date}.pdf`;
}

export function buildAuditExcelFilename(generatedAt: string): string {
  const date = generatedAt.slice(0, 10);
  return `audit-records-${date}.xlsx`;
}
