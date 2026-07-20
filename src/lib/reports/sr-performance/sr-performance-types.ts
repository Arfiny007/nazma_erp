import type { Prisma } from "@prisma/client";

import type { TerritoryScope } from "@/lib/rbac/territory";

/**
 * Domain types for the Printable SR Performance & Ledger Dashboard — PHASE_12A.1.
 *
 * Monetary fields use Prisma.Decimal until mapped to decimal strings at the
 * action boundary. React must never receive Decimal objects or perform arithmetic.
 *
 * @see ADR-060
 */

export const SR_PERFORMANCE_PAGE_SIZES = [25, 50, 100] as const;
export type SrPerformancePageSize = (typeof SR_PERFORMANCE_PAGE_SIZES)[number];

/** Hard cap for print / unpaginated dealer rows. */
export const SR_PERFORMANCE_PRINT_DEALER_CAP = 5000;

export type SrPerformancePrintMode = "individual" | "overview";

/** Canonical URL filter state (shared by screen + print). */
export interface SrPerformanceUrlFilters {
  from: Date;
  to: Date;
  territoryId: string | null;
  srId: string | null;
  srSearch: string;
  partySearch: string;
  page: number;
  pageSize: SrPerformancePageSize;
  mode: SrPerformancePrintMode | null;
}

export interface SrPerformanceFilterParams {
  from: Date | string;
  to: Date | string;
  /** Inclusive UI date; exclusive DB upper bound is derived in the query layer. */
  territoryId?: string | null;
  srId?: string | null;
  srSearch?: string;
  partySearch?: string;
  page?: number;
  pageSize?: SrPerformancePageSize;
  mode?: SrPerformancePrintMode | null;
}

export interface SrDealerStatementRow {
  dealerCode: string;
  partyName: string;
  territoryId: string | null;
  territoryName: string | null;
  previousDue: Prisma.Decimal;
  sales: Prisma.Decimal;
  collection: Prisma.Decimal;
  balanceDue: Prisma.Decimal;
  reconciliationDelta: Prisma.Decimal;
  unsupportedPostingCount: number;
}

export interface SrPerformanceOverviewRow {
  srId: string;
  srName: string;
  territoryIds: string[];
  territoryNames: string[];
  dealerCount: number;
  previousDue: Prisma.Decimal;
  sales: Prisma.Decimal;
  collection: Prisma.Decimal;
  netBalance: Prisma.Decimal;
  reconciliationDelta: Prisma.Decimal;
}

export interface SrPerformanceTotals {
  previousDue: Prisma.Decimal;
  sales: Prisma.Decimal;
  collection: Prisma.Decimal;
  netBalance: Prisma.Decimal;
}

/** Dealer ownership attribution integrity (financial warning source). */
export interface SrAttributionDiagnostics {
  duplicateDealerAttributionCount: number;
  missingOwnershipCount: number;
  ambiguousOwnershipCount: number;
  affectedDealerCodes: string[];
}

export interface SrPerformanceDiagnostics {
  unsupportedPostingCount: number;
  attributionWarnings: string[];
  reconciliationWarnings: string[];
  /** Developer metadata only — never a user-facing financial warning by itself. */
  overlappingTerritoryIds: string[];
  attribution: SrAttributionDiagnostics;
}

export interface SrDealerStatementResult {
  selectedSr: {
    id: string;
    name: string;
    territoryIds: string[];
    territoryNames: string[];
  } | null;
  rows: SrDealerStatementRow[];
  totals: SrPerformanceTotals;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  diagnostics: SrPerformanceDiagnostics;
  generatedAt: Date;
  filters: {
    from: Date;
    to: Date;
    territoryId: string | null;
    srId: string | null;
    srSearch: string;
    partySearch: string;
  };
}

export interface SrPerformanceOverviewResult {
  rows: SrPerformanceOverviewRow[];
  totals: SrPerformanceTotals;
  diagnostics: SrPerformanceDiagnostics;
  generatedAt: Date;
  filters: {
    from: Date;
    to: Date;
    territoryId: string | null;
    srId: string | null;
    srSearch: string;
    partySearch: string;
  };
}

export interface SrPerformancePrintPayload {
  generatedAt: Date;
  mode: SrPerformancePrintMode;
  filters: {
    from: Date;
    to: Date;
    territoryId: string | null;
    territoryName: string | null;
    srId: string | null;
    srSearch: string;
    partySearch: string;
  };
  selectedSr: {
    id: string;
    name: string;
    territoryNames: string[];
  } | null;
  individualRows: SrDealerStatementRow[];
  individualTotals: SrPerformanceTotals;
  overviewRows: SrPerformanceOverviewRow[];
  overviewTotals: SrPerformanceTotals;
  diagnostics: SrPerformanceDiagnostics;
}

export interface SrPerformanceServiceContext {
  scope: TerritoryScope;
}

/** Per-dealer ledger aggregates used before DTO mapping. */
export interface DealerLedgerAggregate {
  dealerCode: string;
  previousDue: Prisma.Decimal;
  sales: Prisma.Decimal;
  collection: Prisma.Decimal;
  ledgerMovement: Prisma.Decimal;
  unsupportedPostingCount: number;
}

export interface ScopedDealerRow {
  dealerCode: string;
  partyName: string;
  territoryId: string | null;
  territoryName: string | null;
  assignedSrId: string | null;
  /** Count of active ownership rows (integrity). */
  activeOwnershipCount: number;
  /** Distinct active assignedSrId values (integrity). */
  distinctAssignedSrCount: number;
}

export interface ScopedSrRow {
  srId: string;
  srName: string;
  territoryIds: string[];
  territoryNames: string[];
}
