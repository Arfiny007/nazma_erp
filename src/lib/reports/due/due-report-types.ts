import type { Prisma } from "@prisma/client";

/**
 * Enterprise Due Report types — PHASE_08D.
 *
 * All monetary fields in domain results use `Prisma.Decimal`. String conversion
 * happens at the server-action DTO boundary.
 *
 * Financial source of truth:
 *   `Dealer.currentBalance` for dealer-level due
 *   Invoice outstanding + `dueDate` for aging buckets (read-only)
 *
 * @see ADR-040
 */

export type AgingBucket =
  | "current"
  | "days30"
  | "days60"
  | "days90"
  | "days90Plus";

export type TerritoryGroupBy = "division" | "district" | "territory";

export interface DueReportRow {
  dealerCode: string;
  dealerName: string;
  divisionName: string | null;
  districtName: string | null;
  territoryName: string | null;
  assignedSrName: string | null;
  currentBalance: Prisma.Decimal;
  lastInvoiceDate: Date | null;
  lastCollectionDate: Date | null;
  ledgerIntegrity: boolean;
}

export interface DueAging {
  current: Prisma.Decimal;
  days30: Prisma.Decimal;
  days60: Prisma.Decimal;
  days90: Prisma.Decimal;
  days90Plus: Prisma.Decimal;
}

export interface DueReportFilters {
  divisionId?: string;
  districtId?: string;
  territoryId?: string;
  assignedSrId?: string;
  dealerCode?: string;
  agingBucket?: AgingBucket;
  balanceMin?: Prisma.Decimal;
  balanceMax?: Prisma.Decimal;
  fromDate?: Date;
  toDate?: Date;
  includeZeroBalance?: boolean;
  includeAdvance?: boolean;
  page: number;
  pageSize: number;
}

export interface DueReportResult {
  rows: DueReportRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface TerritoryDueGroup {
  groupId: string;
  groupName: string;
  groupType: TerritoryGroupBy;
  dealerCount: number;
  totalDue: Prisma.Decimal;
  totalAdvance: Prisma.Decimal;
  netBalance: Prisma.Decimal;
}

export interface SrDueGroup {
  srId: string | null;
  srName: string | null;
  dealerCount: number;
  totalDue: Prisma.Decimal;
  totalAdvance: Prisma.Decimal;
  netBalance: Prisma.Decimal;
}

export interface CompanyDueSummary {
  totalDealers: number;
  dealersWithDue: number;
  dealersWithAdvance: number;
  totalDue: Prisma.Decimal;
  totalAdvance: Prisma.Decimal;
  netReceivable: Prisma.Decimal;
  aging: DueAging;
  integrityIssues: number;
}

export interface TerritoryDueReportResult {
  groups: TerritoryDueGroup[];
  groupBy: TerritoryGroupBy;
  summary: CompanyDueSummary;
}

export interface SrDueReportResult {
  groups: SrDueGroup[];
  summary: CompanyDueSummary;
}

export interface DueAgingReportResult {
  aging: DueAging;
  dealerCount: number;
  invoiceCount: number;
}

export interface GetDealerDueReportParams {
  dealerCode: string;
}

export interface GetTerritoryDueReportParams {
  groupBy: TerritoryGroupBy;
  divisionId?: string;
  districtId?: string;
  territoryId?: string;
  assignedSrId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface GetSrDueReportParams {
  divisionId?: string;
  districtId?: string;
  territoryId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface GetCompanyDueSummaryParams {
  divisionId?: string;
  districtId?: string;
  territoryId?: string;
  assignedSrId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface GetDueAgingReportParams {
  divisionId?: string;
  districtId?: string;
  territoryId?: string;
  assignedSrId?: string;
  dealerCode?: string;
  asOfDate?: Date;
}
