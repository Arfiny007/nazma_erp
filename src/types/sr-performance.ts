/**
 * Transport-safe DTOs for SR Performance server actions — PHASE_12A / ADR-060.
 * All monetary fields are Decimal(18,2) strings.
 */

export type SrPerformanceErrorCode =
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "INVALID_DATE_RANGE"
  | "INVALID_PAGINATION"
  | "EMPTY_TERRITORY_SCOPE"
  | "SR_OUT_OF_SCOPE"
  | "TERRITORY_OUT_OF_SCOPE"
  | "REPORT_CAP_EXCEEDED"
  | "INTERNAL_ERROR";

export interface FieldError {
  field: string;
  messageKey: string;
}

export interface SrPerformanceActionError {
  code: SrPerformanceErrorCode;
  messageKey: string;
  fieldErrors?: FieldError[];
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: SrPerformanceActionError };

export interface SrPerformanceTotalsDTO {
  previousDue: string;
  sales: string;
  collection: string;
  netBalance: string;
}

export type SrPerformancePrintMode = "individual" | "overview";

export interface SrPerformanceFiltersDTO {
  from: string;
  to: string;
  territoryId: string | null;
  territoryName?: string | null;
  srId: string | null;
  srSearch: string;
  partySearch: string;
}

export interface SrAttributionDiagnosticsDTO {
  duplicateDealerAttributionCount: number;
  missingOwnershipCount: number;
  ambiguousOwnershipCount: number;
  affectedDealerCodes: string[];
}

export interface SrPerformanceDiagnosticsDTO {
  unsupportedPostingCount: number;
  attributionWarnings: string[];
  reconciliationWarnings: string[];
  /** Developer metadata only — not a user-facing financial warning by itself. */
  overlappingTerritoryIds: string[];
  attribution: SrAttributionDiagnosticsDTO;
}

export interface SrDealerStatementRowDTO {
  dealerCode: string;
  partyName: string;
  territoryId: string | null;
  territoryName: string | null;
  previousDue: string;
  sales: string;
  collection: string;
  balanceDue: string;
  reconciliationDelta: string;
}

export interface SrPerformanceOverviewRowDTO {
  srId: string;
  srName: string;
  territoryIds: string[];
  territoryNames: string[];
  dealerCount: number;
  previousDue: string;
  sales: string;
  collection: string;
  netBalance: string;
  reconciliationDelta: string;
}

export interface SrDealerStatementResultDTO {
  selectedSr: {
    id: string;
    name: string;
    territoryIds: string[];
    territoryNames: string[];
  } | null;
  rows: SrDealerStatementRowDTO[];
  totals: SrPerformanceTotalsDTO;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  diagnostics: SrPerformanceDiagnosticsDTO;
  generatedAt: string;
  filters: SrPerformanceFiltersDTO;
}

export interface SrPerformanceOverviewResultDTO {
  rows: SrPerformanceOverviewRowDTO[];
  totals: SrPerformanceTotalsDTO;
  diagnostics: SrPerformanceDiagnosticsDTO;
  generatedAt: string;
  filters: SrPerformanceFiltersDTO;
}

export interface SrPerformancePrintPayloadDTO {
  generatedAt: string;
  mode: SrPerformancePrintMode;
  filters: SrPerformanceFiltersDTO;
  selectedSr: {
    id: string;
    name: string;
    territoryNames: string[];
  } | null;
  individualRows: SrDealerStatementRowDTO[];
  individualTotals: SrPerformanceTotalsDTO;
  overviewRows: SrPerformanceOverviewRowDTO[];
  overviewTotals: SrPerformanceTotalsDTO;
  diagnostics: SrPerformanceDiagnosticsDTO;
}

export interface TerritoryOptionDTO {
  id: string;
  name: string;
}
