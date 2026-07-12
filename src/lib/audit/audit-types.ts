import type { UserRole } from "@prisma/client";

/**
 * Enterprise Audit Console contracts — PHASE_09D.
 *
 * Read-only operational observability over persisted {@link AuditLog} rows.
 * No mutation, replay, or repair actions.
 *
 * @see ADR-046
 */

export type AuditRecord = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  userName: string | null;
  role: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type AuditFilters = {
  search?: string;
  userId?: string;
  role?: string;
  action?: string;
  entityType?: string;
  fromDate?: string;
  toDate?: string;
  page: number;
  pageSize: number;
};

export type AuditCategory =
  | "financial"
  | "dealer"
  | "security"
  | "integrity"
  | "system"
  | "operational";

export type AuditRole = Extract<
  UserRole,
  "Super_Admin" | "Accounts" | "Manager" | "SR"
>;

export type AuditSummary = {
  totalEvents: number;
  financialEvents: number;
  securityEvents: number;
  dealerEvents: number;
  integrityEvents: number;
};

export type AuditTimelineGroupKey =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "older";

export interface AuditTimelineGroup {
  key: AuditTimelineGroupKey;
  labelKey: string;
  records: AuditRecord[];
}

export interface AuditQueryResult {
  records: AuditRecord[];
  summary: AuditSummary;
  timeline: AuditTimelineGroup[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  generatedAt: string;
}

export interface AuditQueryOptions {
  maxPageSize?: number;
}

export interface AuditContext {
  userId: string;
  role: AuditRole;
}
