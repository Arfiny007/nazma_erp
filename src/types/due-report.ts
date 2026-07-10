import type {
  AgingBucket,
  CompanyDueSummary,
  DueAging,
  DueAgingReportResult,
  DueReportResult,
  DueReportRow,
  SrDueReportResult,
  TerritoryDueReportResult,
  TerritoryGroupBy,
} from "@/lib/reports/due";

/**
 * Transport-safe DTOs for Due Report server actions — PHASE_08D.
 */

export type DueReportErrorCode =
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "DEALER_NOT_FOUND"
  | "INVALID_DATE_RANGE"
  | "INVALID_PAGINATION"
  | "INVALID_BALANCE_RANGE"
  | "INTERNAL_ERROR";

export interface FieldError {
  field: string;
  messageKey: string;
}

export interface DueReportActionError {
  code: DueReportErrorCode;
  messageKey: string;
  fieldErrors?: FieldError[];
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: DueReportActionError };

export interface DueReportRowDTO {
  dealerCode: string;
  dealerName: string;
  divisionName: string | null;
  districtName: string | null;
  territoryName: string | null;
  assignedSrName: string | null;
  currentBalance: string;
  lastInvoiceDate: string | null;
  lastCollectionDate: string | null;
  ledgerIntegrity: boolean;
}

export interface DueAgingDTO {
  current: string;
  days30: string;
  days60: string;
  days90: string;
  days90Plus: string;
}

export interface DueReportResultDTO {
  rows: DueReportRowDTO[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface TerritoryDueGroupDTO {
  groupId: string;
  groupName: string;
  groupType: TerritoryGroupBy;
  dealerCount: number;
  totalDue: string;
  totalAdvance: string;
  netBalance: string;
}

export interface SrDueGroupDTO {
  srId: string | null;
  srName: string | null;
  dealerCount: number;
  totalDue: string;
  totalAdvance: string;
  netBalance: string;
}

export interface CompanyDueSummaryDTO {
  totalDealers: number;
  dealersWithDue: number;
  dealersWithAdvance: number;
  totalDue: string;
  totalAdvance: string;
  netReceivable: string;
  aging: DueAgingDTO;
  integrityIssues: number;
}

export interface TerritoryDueReportResultDTO {
  groups: TerritoryDueGroupDTO[];
  groupBy: TerritoryGroupBy;
  summary: CompanyDueSummaryDTO;
}

export interface SrDueReportResultDTO {
  groups: SrDueGroupDTO[];
  summary: CompanyDueSummaryDTO;
}

export interface DueAgingReportResultDTO {
  aging: DueAgingDTO;
  dealerCount: number;
  invoiceCount: number;
}

export type { AgingBucket, TerritoryGroupBy, DueReportRow, DueAging, DueReportResult, CompanyDueSummary, TerritoryDueReportResult, SrDueReportResult, DueAgingReportResult };
