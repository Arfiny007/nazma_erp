import type {
  CompanyDueSummary,
  DueAging,
  DueAgingReportResult,
  DueReportResult,
  DueReportRow,
  SrDueGroup,
  SrDueReportResult,
  TerritoryDueGroup,
  TerritoryDueReportResult,
} from "@/lib/reports/due";
import type {
  CompanyDueSummaryDTO,
  DueAgingDTO,
  DueAgingReportResultDTO,
  DueReportResultDTO,
  DueReportRowDTO,
  SrDueGroupDTO,
  SrDueReportResultDTO,
  TerritoryDueGroupDTO,
  TerritoryDueReportResultDTO,
} from "@/types/due-report";

function toAgingDTO(aging: DueAging): DueAgingDTO {
  return {
    current: aging.current.toFixed(2),
    days30: aging.days30.toFixed(2),
    days60: aging.days60.toFixed(2),
    days90: aging.days90.toFixed(2),
    days90Plus: aging.days90Plus.toFixed(2),
  };
}

export function toDueReportRowDTO(row: DueReportRow): DueReportRowDTO {
  return {
    dealerCode: row.dealerCode,
    dealerName: row.dealerName,
    divisionName: row.divisionName,
    districtName: row.districtName,
    territoryName: row.territoryName,
    assignedSrName: row.assignedSrName,
    currentBalance: row.currentBalance.toFixed(2),
    lastInvoiceDate: row.lastInvoiceDate?.toISOString() ?? null,
    lastCollectionDate: row.lastCollectionDate?.toISOString() ?? null,
    ledgerIntegrity: row.ledgerIntegrity,
  };
}

function toCompanySummaryDTO(summary: CompanyDueSummary): CompanyDueSummaryDTO {
  return {
    totalDealers: summary.totalDealers,
    dealersWithDue: summary.dealersWithDue,
    dealersWithAdvance: summary.dealersWithAdvance,
    totalDue: summary.totalDue.toFixed(2),
    totalAdvance: summary.totalAdvance.toFixed(2),
    netReceivable: summary.netReceivable.toFixed(2),
    aging: toAgingDTO(summary.aging),
    integrityIssues: summary.integrityIssues,
  };
}

function toTerritoryGroupDTO(group: TerritoryDueGroup): TerritoryDueGroupDTO {
  return {
    groupId: group.groupId,
    groupName: group.groupName,
    groupType: group.groupType,
    dealerCount: group.dealerCount,
    totalDue: group.totalDue.toFixed(2),
    totalAdvance: group.totalAdvance.toFixed(2),
    netBalance: group.netBalance.toFixed(2),
  };
}

function toSrGroupDTO(group: SrDueGroup): SrDueGroupDTO {
  return {
    srId: group.srId,
    srName: group.srName,
    dealerCount: group.dealerCount,
    totalDue: group.totalDue.toFixed(2),
    totalAdvance: group.totalAdvance.toFixed(2),
    netBalance: group.netBalance.toFixed(2),
  };
}

export function toDueReportResultDTO(result: DueReportResult): DueReportResultDTO {
  return {
    rows: result.rows.map(toDueReportRowDTO),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    pageCount: result.pageCount,
  };
}

export function toTerritoryDueReportResultDTO(
  result: TerritoryDueReportResult,
): TerritoryDueReportResultDTO {
  return {
    groups: result.groups.map(toTerritoryGroupDTO),
    groupBy: result.groupBy,
    summary: toCompanySummaryDTO(result.summary),
  };
}

export function toSrDueReportResultDTO(
  result: SrDueReportResult,
): SrDueReportResultDTO {
  return {
    groups: result.groups.map(toSrGroupDTO),
    summary: toCompanySummaryDTO(result.summary),
  };
}

export function toCompanyDueSummaryDTO(
  summary: CompanyDueSummary,
): CompanyDueSummaryDTO {
  return toCompanySummaryDTO(summary);
}

export function toDueAgingReportResultDTO(
  result: DueAgingReportResult,
): DueAgingReportResultDTO {
  return {
    aging: toAgingDTO(result.aging),
    dealerCount: result.dealerCount,
    invoiceCount: result.invoiceCount,
  };
}
