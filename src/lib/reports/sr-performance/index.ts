/**
 * Printable SR Performance & Ledger Dashboard — PHASE_12A / ADR-060.
 *
 * Read-only reporting over LedgerEntry. Does not mutate financial state.
 */

export {
  ZERO,
  buildDealerFinancials,
  calculateBalanceDue,
  calculateNetBalance,
  calculateReconciliationDelta,
  calculateActualClosing,
  classifyPeriodEntry,
  normalizeAggregate,
  sumTotals,
} from "./sr-performance-calculations";

export {
  EmptyTerritoryScopeError,
  SrOutOfScopeError,
  SrPerformanceError,
  TerritoryOutOfScopeError,
} from "./sr-performance-errors";
export type { SrPerformanceErrorCode } from "./sr-performance-errors";

export {
  toDealerRowDTO,
  toDealerStatementResultDTO,
  toOverviewResultDTO,
  toOverviewRowDTO,
  toPrintPayloadDTO,
} from "./sr-performance-mapper";

export {
  aggregateDealerLedgerMetrics,
  aggregateOpeningBalances,
  aggregatePeriodMovements,
  buildAttributionDiagnostics,
  emptyAttributionDiagnostics,
  findOverlappingTerritoryAssignments,
  findScopedActiveSalesRepresentatives,
  findScopedDealersForReport,
  findTerritoryOptionsForScope,
} from "./sr-performance-query";
export type { SrPerformanceReadClient } from "./sr-performance-query";

export {
  getAllowedTerritoryOptions,
  getDefaultSrDealerStatement,
  getSrDealerStatement,
  getSrPerformanceOverview,
  getSrPerformancePrintPayload,
} from "./sr-performance-service";

export {
  assertScopedReportAccess,
  assertSrInScope,
  assertTerritoryInScope,
  assertValidDateRange,
  assertValidPagination,
  buildSrPerformanceQuery,
  defaultReportDateRange,
  defaultUrlFilters,
  formatLocalDateOnly,
  mergeSrPerformanceFilters,
  normalizeFilters,
  parseLocalDateOnly,
  parseSrPerformanceFilters,
  resolveSrIdInScope,
  startOfDayAfter,
  toExclusiveDateBounds,
} from "./sr-performance-validation";

export type {
  DealerLedgerAggregate,
  ScopedDealerRow,
  ScopedSrRow,
  SrAttributionDiagnostics,
  SrDealerStatementResult,
  SrDealerStatementRow,
  SrPerformanceDiagnostics,
  SrPerformanceFilterParams,
  SrPerformanceOverviewResult,
  SrPerformanceOverviewRow,
  SrPerformancePageSize,
  SrPerformancePrintMode,
  SrPerformancePrintPayload,
  SrPerformanceServiceContext,
  SrPerformanceTotals,
  SrPerformanceUrlFilters,
} from "./sr-performance-types";
export {
  SR_PERFORMANCE_PAGE_SIZES,
  SR_PERFORMANCE_PRINT_DEALER_CAP,
} from "./sr-performance-types";
