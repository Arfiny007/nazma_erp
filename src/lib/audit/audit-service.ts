import { prisma } from "@/lib/prisma";
import { buildTerritoryScope } from "@/lib/rbac/territory";

import {
  buildAuditSummary,
  buildEmptyAuditSummary,
  groupAuditTimeline,
  mapAuditLogRow,
} from "./audit-mappers";
import {
  buildAuditWhereClause,
  countAuditLogs,
  findAuditLogs,
  findAuditLogsForSummary,
  filterRowsForRole,
  type AuditReadClient,
} from "./audit-query";
import type {
  AuditContext,
  AuditFilters,
  AuditQueryOptions,
  AuditQueryResult,
} from "./audit-types";
import {
  assertScopedAuditAccess,
  categoryMatchesRole,
  normalizeAuditFilters,
} from "./audit-validation";

/**
 * Enterprise Audit Console read service — PHASE_09D.
 *
 * Consumes persisted {@link AuditLog} rows only. Never mutates financial data.
 */
export async function getAuditConsoleData(
  context: AuditContext,
  filters: AuditFilters,
  client: AuditReadClient = prisma,
  options?: AuditQueryOptions,
): Promise<AuditQueryResult> {
  const normalized = normalizeAuditFilters(filters, options);
  const scope = await buildTerritoryScope(context.userId);
  assertScopedAuditAccess(scope);

  const where = await buildAuditWhereClause(context, normalized, client);
  const generatedAt = new Date();

  const [total, rows, summaryRows] = await Promise.all([
    countAuditLogs(where, client),
    findAuditLogs(where, normalized.page, normalized.pageSize, client),
    findAuditLogsForSummary(where, client),
  ]);

  const filteredSummaryRows = filterRowsForRole(context.role, summaryRows);
  const records = rows
    .filter((row) => categoryMatchesRole(context.role, row.action, row.entityType))
    .map(mapAuditLogRow);
  const timeline = groupAuditTimeline(records);

  return {
    records,
    summary:
      filteredSummaryRows.length > 0
        ? buildAuditSummary(filteredSummaryRows)
        : buildEmptyAuditSummary(),
    timeline,
    page: normalized.page,
    pageSize: normalized.pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / normalized.pageSize),
    generatedAt: generatedAt.toISOString(),
  };
}
