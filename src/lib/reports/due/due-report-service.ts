import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { TerritoryScope } from "@/lib/rbac/territory";

import { accumulateInvoiceAging } from "./due-aging";
import { DealerDueNotFoundError } from "./due-report-errors";
import {
  batchCheckLedgerIntegrity,
  buildDueReportWhere,
  buildSummaryWhere,
  countDealersForDueReport,
  findAgingInvoices,
  findAllDealersForAggregation,
  findDealerCodesMatchingAgingBucket,
  findDealerForDueReport,
  findDealersForDueReport,
  findOwnershipHistoriesForDealers,
  groupDealersBySr,
  groupDealersByTerritory,
  resolveOwnershipAtDate,
  type DueReportReadClient,
} from "./due-report-query";
import type {
  CompanyDueSummary,
  DueAgingReportResult,
  DueReportFilters,
  DueReportResult,
  DueReportRow,
  GetCompanyDueSummaryParams,
  GetDealerDueReportParams,
  GetDueAgingReportParams,
  GetSrDueReportParams,
  GetTerritoryDueReportParams,
  SrDueGroup,
  SrDueReportResult,
  TerritoryDueGroup,
  TerritoryDueReportResult,
} from "./due-report-types";
import {
  advanceAmount,
  assertValidDueReportFilters,
  dueAmount,
  isAdvance,
  isPositiveDue,
} from "./due-report-validation";

/**
 * Enterprise Due Report Engine — PHASE_08D.
 *
 * Read-only reporting over existing financial engines. Never mutates
 * `Dealer.currentBalance`, `LedgerEntry`, invoices, or collections.
 *
 * Source of truth:
 *   Dealer.currentBalance — dealer-level due/advance
 *   Invoice outstanding + dueDate — aging buckets only
 *
 * @see ADR-040
 */

const ZERO = new Prisma.Decimal(0);

function mapDealerToDueRow(
  dealer: Awaited<ReturnType<typeof findDealerForDueReport>> & object,
  integrityMap: Map<string, boolean>,
): DueReportRow {
  const ownership = dealer.ownershipHistory[0];

  return {
    dealerCode: dealer.dealerCode,
    dealerName: dealer.companyName,
    divisionName: dealer.division?.name ?? null,
    districtName: dealer.geoDistrict?.name ?? null,
    territoryName: dealer.geoTerritory?.name ?? null,
    assignedSrName: ownership?.assignedSr?.name ?? null,
    currentBalance: dealer.currentBalance,
    lastInvoiceDate: dealer.lastInvoiceDate,
    lastCollectionDate: dealer.lastCollectionDate,
    ledgerIntegrity: integrityMap.get(dealer.dealerCode) ?? true,
  };
}

function buildCompanySummary(
  dealers: readonly DueReportRow[],
  aging: ReturnType<typeof accumulateInvoiceAging>,
): CompanyDueSummary {
  let totalDue = ZERO;
  let totalAdvance = ZERO;
  let dealersWithDue = 0;
  let dealersWithAdvance = 0;
  let integrityIssues = 0;

  for (const dealer of dealers) {
    if (isPositiveDue(dealer.currentBalance)) {
      totalDue = totalDue.plus(dealer.currentBalance);
      dealersWithDue += 1;
    } else if (isAdvance(dealer.currentBalance)) {
      totalAdvance = totalAdvance.plus(advanceAmount(dealer.currentBalance));
      dealersWithAdvance += 1;
    }
    if (!dealer.ledgerIntegrity) {
      integrityIssues += 1;
    }
  }

  return {
    totalDealers: dealers.length,
    dealersWithDue,
    dealersWithAdvance,
    totalDue,
    totalAdvance,
    netReceivable: totalDue.minus(totalAdvance),
    aging,
    integrityIssues,
  };
}

function aggregateTerritoryGroup(
  groupId: string,
  groupName: string,
  groupType: GetTerritoryDueReportParams["groupBy"],
  dealers: readonly DueReportRow[],
): TerritoryDueGroup {
  let totalDue = ZERO;
  let totalAdvance = ZERO;

  for (const dealer of dealers) {
    totalDue = totalDue.plus(dueAmount(dealer.currentBalance));
    totalAdvance = totalAdvance.plus(advanceAmount(dealer.currentBalance));
  }

  return {
    groupId,
    groupName,
    groupType,
    dealerCount: dealers.length,
    totalDue,
    totalAdvance,
    netBalance: totalDue.minus(totalAdvance),
  };
}

function aggregateSrGroup(
  srId: string | null,
  srName: string | null,
  dealers: readonly DueReportRow[],
): SrDueGroup {
  let totalDue = ZERO;
  let totalAdvance = ZERO;

  for (const dealer of dealers) {
    totalDue = totalDue.plus(dueAmount(dealer.currentBalance));
    totalAdvance = totalAdvance.plus(advanceAmount(dealer.currentBalance));
  }

  return {
    srId,
    srName,
    dealerCount: dealers.length,
    totalDue,
    totalAdvance,
    netBalance: totalDue.minus(totalAdvance),
  };
}

async function loadDueRows(
  client: DueReportReadClient,
  where: Parameters<typeof findDealersForDueReport>[1],
  options?: { skip?: number; take?: number },
): Promise<DueReportRow[]> {
  const dealers = await findDealersForDueReport(client, where, options);
  const integrityMap = await batchCheckLedgerIntegrity(
    client,
    dealers.map((d) => d.dealerCode),
  );
  return dealers.map((dealer) => mapDealerToDueRow(dealer, integrityMap));
}

/**
 * Paginated dealer due report with server-side filters.
 */
export async function getDueReport(
  filters: DueReportFilters,
  scope: TerritoryScope,
  client: DueReportReadClient = prisma,
): Promise<DueReportResult> {
  assertValidDueReportFilters(filters);

  let where = buildDueReportWhere(filters, scope);

  if (filters.agingBucket) {
    const asOfDate = filters.toDate ?? new Date();
    const matchingCodes = await findDealerCodesMatchingAgingBucket(
      client,
      buildSummaryWhere(filters, scope),
      filters.agingBucket,
      asOfDate,
    );
    where = {
      AND: [where, { dealerCode: { in: [...matchingCodes] } }],
    };
  }

  const [total, rows] = await Promise.all([
    countDealersForDueReport(client, where),
    loadDueRows(client, where, {
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  const pageCount = total === 0 ? 0 : Math.ceil(total / filters.pageSize);

  return {
    rows,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    pageCount,
  };
}

/**
 * Single-dealer due report row.
 */
export async function getDealerDueReport(
  params: GetDealerDueReportParams,
  client: DueReportReadClient = prisma,
): Promise<DueReportRow> {
  const dealer = await findDealerForDueReport(client, params.dealerCode);
  if (!dealer) {
    throw new DealerDueNotFoundError(params.dealerCode);
  }

  const integrityMap = await batchCheckLedgerIntegrity(client, [params.dealerCode]);
  return mapDealerToDueRow(dealer, integrityMap);
}

/**
 * Territory-grouped due aggregation (division / district / territory).
 */
export async function getTerritoryDueReport(
  params: GetTerritoryDueReportParams,
  scope: TerritoryScope,
  client: DueReportReadClient = prisma,
): Promise<TerritoryDueReportResult> {
  const where = buildSummaryWhere(params, scope);
  const dealerRows = await findAllDealersForAggregation(client, where);
  const integrityMap = await batchCheckLedgerIntegrity(
    client,
    dealerRows.map((d) => d.dealerCode),
  );
  const dealers = dealerRows.map((dealer) =>
    mapDealerToDueRow(dealer, integrityMap),
  );

  const grouped = groupDealersByTerritory(dealerRows, params.groupBy);
  const dealerByCode = new Map(dealers.map((row) => [row.dealerCode, row]));

  const groups: TerritoryDueGroup[] = [];
  for (const [groupId, { name, dealers: groupDealers }] of grouped) {
    const groupRows = groupDealers.map((d) => dealerByCode.get(d.dealerCode)!);
    groups.push(
      aggregateTerritoryGroup(groupId, name, params.groupBy, groupRows),
    );
  }

  groups.sort((a, b) => b.totalDue.minus(a.totalDue).toNumber());

  const invoices = await findAgingInvoices(client, where);
  const aging = accumulateInvoiceAging(invoices, params.toDate ?? new Date());

  return {
    groups,
    groupBy: params.groupBy,
    summary: buildCompanySummary(dealers, aging),
  };
}

/**
 * SR-grouped due aggregation using current active ownership.
 */
export async function getSrDueReport(
  params: GetSrDueReportParams,
  scope: TerritoryScope,
  client: DueReportReadClient = prisma,
): Promise<SrDueReportResult> {
  const where = buildSummaryWhere(params, scope);
  const dealerRows = await findAllDealersForAggregation(client, where);
  const integrityMap = await batchCheckLedgerIntegrity(
    client,
    dealerRows.map((d) => d.dealerCode),
  );
  const dealers = dealerRows.map((dealer) =>
    mapDealerToDueRow(dealer, integrityMap),
  );

  const grouped = groupDealersBySr(dealerRows);
  const groups: SrDueGroup[] = [];

  for (const [srId, { name, dealers: groupDealers }] of grouped) {
    const groupRows = groupDealers.map((d) =>
      dealers.find((row) => row.dealerCode === d.dealerCode)!,
    );
    groups.push(aggregateSrGroup(srId, name, groupRows));
  }

  groups.sort((a, b) => b.totalDue.minus(a.totalDue).toNumber());

  const invoices = await findAgingInvoices(client, where);
  const aging = accumulateInvoiceAging(invoices, params.toDate ?? new Date());

  return {
    groups,
    summary: buildCompanySummary(dealers, aging),
  };
}

/**
 * Company-wide due summary with aging totals.
 */
export async function getCompanyDueSummary(
  params: GetCompanyDueSummaryParams,
  scope: TerritoryScope,
  client: DueReportReadClient = prisma,
): Promise<CompanyDueSummary> {
  const where = buildSummaryWhere(params, scope);
  const dealers = await loadDueRows(client, where);
  const invoices = await findAgingInvoices(client, where);
  const aging = accumulateInvoiceAging(invoices, params.toDate ?? new Date());
  return buildCompanySummary(dealers, aging);
}

/**
 * Invoice aging report with ownership-aware invoice attribution.
 *
 * Invoices are attributed to the SR who owned the dealer at `issueDate`
 * (read-only join on `DealerOwnershipHistory`).
 */
export async function getDueAgingReport(
  params: GetDueAgingReportParams,
  scope: TerritoryScope,
  client: DueReportReadClient = prisma,
): Promise<DueAgingReportResult> {
  const where = buildSummaryWhere(params, scope);
  const asOfDate = params.asOfDate ?? new Date();

  let invoices = await findAgingInvoices(client, where);

  if (params.assignedSrId) {
    const dealerRows = await findAllDealersForAggregation(client, where);
    const histories = await findOwnershipHistoriesForDealers(
      client,
      dealerRows.map((d) => d.id),
    );

    invoices = invoices.filter((invoice) => {
      const dealer = dealerRows.find((d) => d.dealerCode === invoice.dealerCode);
      if (!dealer) {
        return false;
      }
      const ownership = resolveOwnershipAtDate(
        histories,
        dealer.id,
        invoice.issueDate,
      );
      return ownership?.assignedSrId === params.assignedSrId;
    });
  }

  const aging = accumulateInvoiceAging(invoices, asOfDate);
  const dealerCodes = new Set(invoices.map((inv) => inv.dealerCode));

  return {
    aging,
    dealerCount: dealerCodes.size,
    invoiceCount: invoices.length,
  };
}
