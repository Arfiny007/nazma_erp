import type { AuditFilters, AuditQueryResult, AuditRecord } from "../audit-types";

/**
 * Enterprise Audit Export contracts — PHASE_09E.
 *
 * Exports consume {@link getAuditConsoleData} only — no alternate query layer.
 *
 * @see ADR-048
 */

export const MAX_AUDIT_EXPORT_BATCH = 10_000;

export type AuditExportFormat = "pdf" | "excel" | "archive";

export interface AuditExportActor {
  userId: string;
  userName: string;
  role: string;
}

export interface AuditExportPayload {
  console: AuditQueryResult;
  filters: AuditFilters;
  actor: AuditExportActor;
  recordCount: number;
}

export interface AuditComplianceSummary {
  generatedAt: string;
  generatedBy: string;
  filters: AuditFilters;
  recordCount: number;
  categoryCounts: Record<string, number>;
}

export interface AuditExportFile {
  filename: string;
  contentType: string;
  data: string;
  recordCount: number;
}

export interface AuditExcelRow {
  date: string;
  action: string;
  category: string;
  entityType: string;
  entityId: string;
  user: string;
  role: string;
  territory: string;
  metadataSummary: string;
}

export type { AuditRecord };
