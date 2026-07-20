import type {
  SrAttributionDiagnostics,
  SrDealerStatementResult,
  SrDealerStatementRow,
  SrPerformanceDiagnostics,
  SrPerformanceOverviewResult,
  SrPerformanceOverviewRow,
  SrPerformancePrintPayload,
  SrPerformanceTotals,
} from "./sr-performance-types";
import { formatLocalDateOnly } from "./sr-performance-validation";

/**
 * Decimal → string mapping for SR Performance DTOs — PHASE_12A.1.
 * Presentation formatting happens in UI via formatMoney; this layer only
 * serializes Decimal(18,2) as fixed two-decimal strings.
 */

function money(value: { toFixed: (digits: number) => string }): string {
  return value.toFixed(2);
}

function toTotalsDTO(totals: SrPerformanceTotals) {
  return {
    previousDue: money(totals.previousDue),
    sales: money(totals.sales),
    collection: money(totals.collection),
    netBalance: money(totals.netBalance),
  };
}

function toAttributionDTO(attribution: SrAttributionDiagnostics) {
  return {
    duplicateDealerAttributionCount: attribution.duplicateDealerAttributionCount,
    missingOwnershipCount: attribution.missingOwnershipCount,
    ambiguousOwnershipCount: attribution.ambiguousOwnershipCount,
    affectedDealerCodes: [...attribution.affectedDealerCodes],
  };
}

function toDiagnosticsDTO(diagnostics: SrPerformanceDiagnostics) {
  return {
    unsupportedPostingCount: diagnostics.unsupportedPostingCount,
    attributionWarnings: [...diagnostics.attributionWarnings],
    reconciliationWarnings: [...diagnostics.reconciliationWarnings],
    overlappingTerritoryIds: [...diagnostics.overlappingTerritoryIds],
    attribution: toAttributionDTO(diagnostics.attribution),
  };
}

function toFiltersDTO(filters: {
  from: Date;
  to: Date;
  territoryId: string | null;
  territoryName?: string | null;
  srId: string | null;
  srSearch: string;
  partySearch: string;
}) {
  return {
    from: formatLocalDateOnly(filters.from),
    to: formatLocalDateOnly(filters.to),
    territoryId: filters.territoryId,
    territoryName: filters.territoryName ?? null,
    srId: filters.srId,
    srSearch: filters.srSearch,
    partySearch: filters.partySearch,
  };
}

export function toDealerRowDTO(row: SrDealerStatementRow) {
  return {
    dealerCode: row.dealerCode,
    partyName: row.partyName,
    territoryId: row.territoryId,
    territoryName: row.territoryName,
    previousDue: money(row.previousDue),
    sales: money(row.sales),
    collection: money(row.collection),
    balanceDue: money(row.balanceDue),
    reconciliationDelta: money(row.reconciliationDelta),
  };
}

export function toOverviewRowDTO(row: SrPerformanceOverviewRow) {
  return {
    srId: row.srId,
    srName: row.srName,
    territoryIds: [...row.territoryIds],
    territoryNames: [...row.territoryNames],
    dealerCount: row.dealerCount,
    previousDue: money(row.previousDue),
    sales: money(row.sales),
    collection: money(row.collection),
    netBalance: money(row.netBalance),
    reconciliationDelta: money(row.reconciliationDelta),
  };
}

export function toOverviewResultDTO(result: SrPerformanceOverviewResult) {
  return {
    rows: result.rows.map(toOverviewRowDTO),
    totals: toTotalsDTO(result.totals),
    diagnostics: toDiagnosticsDTO(result.diagnostics),
    generatedAt: result.generatedAt.toISOString(),
    filters: toFiltersDTO(result.filters),
  };
}

export function toDealerStatementResultDTO(result: SrDealerStatementResult) {
  return {
    selectedSr: result.selectedSr
      ? {
          id: result.selectedSr.id,
          name: result.selectedSr.name,
          territoryIds: [...result.selectedSr.territoryIds],
          territoryNames: [...result.selectedSr.territoryNames],
        }
      : null,
    rows: result.rows.map(toDealerRowDTO),
    totals: toTotalsDTO(result.totals),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    pageCount: result.pageCount,
    diagnostics: toDiagnosticsDTO(result.diagnostics),
    generatedAt: result.generatedAt.toISOString(),
    filters: toFiltersDTO(result.filters),
  };
}

export function toPrintPayloadDTO(payload: SrPerformancePrintPayload) {
  return {
    generatedAt: payload.generatedAt.toISOString(),
    mode: payload.mode,
    filters: toFiltersDTO(payload.filters),
    selectedSr: payload.selectedSr
      ? {
          id: payload.selectedSr.id,
          name: payload.selectedSr.name,
          territoryNames: [...payload.selectedSr.territoryNames],
        }
      : null,
    individualRows: payload.individualRows.map(toDealerRowDTO),
    individualTotals: toTotalsDTO(payload.individualTotals),
    overviewRows: payload.overviewRows.map(toOverviewRowDTO),
    overviewTotals: toTotalsDTO(payload.overviewTotals),
    diagnostics: toDiagnosticsDTO(payload.diagnostics),
  };
}
