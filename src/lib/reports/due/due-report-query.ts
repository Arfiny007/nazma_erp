import { InvoiceStatus, Prisma } from "@prisma/client";

import { computeInvoiceOutstanding } from "@/lib/collections/workflow";
import { reconcileDealerLedger } from "@/lib/ledger/ledger-reconciliation";
import type { TerritoryScope } from "@/lib/rbac/territory";
import { mergeDealerTerritoryScope } from "@/lib/rbac/territory";

import {
  classifyAgingBucket,
  computeDaysOverdue,
  isAllocatableInvoiceStatus,
} from "./due-aging";
import type {
  AgingBucket,
  DueReportFilters,
  GetCompanyDueSummaryParams,
  GetDueAgingReportParams,
  GetSrDueReportParams,
  GetTerritoryDueReportParams,
  TerritoryGroupBy,
} from "./due-report-types";

/**
 * Read-only Prisma queries backing the Due Report engine — PHASE_08D.
 *
 * Never mutates financial data. `Dealer.currentBalance` is read verbatim;
 * invoice outstanding is used only for aging classification.
 */

const ZERO = new Prisma.Decimal(0);

export type DueReportReadClient = Pick<
  Prisma.TransactionClient,
  "dealer" | "invoice" | "ledgerEntry"
> & {
  dealerOwnershipHistory?: Pick<
    Prisma.TransactionClient["dealerOwnershipHistory"],
    "findMany"
  >;
};

const dealerDueSelect = {
  id: true,
  dealerCode: true,
  companyName: true,
  currentBalance: true,
  lastInvoiceDate: true,
  lastCollectionDate: true,
  divisionId: true,
  districtId: true,
  territoryId: true,
  division: { select: { name: true } },
  geoDistrict: { select: { name: true } },
  geoTerritory: { select: { name: true } },
  ownershipHistory: {
    where: { isActive: true },
    take: 1,
    orderBy: { effectiveFrom: "desc" as const },
    select: {
      assignedSr: { select: { id: true, name: true } },
    },
  },
} as const;

export type DealerDueRow = Prisma.DealerGetPayload<{
  select: typeof dealerDueSelect;
}>;

export interface ScopedDealerFilterParams {
  divisionId?: string;
  districtId?: string;
  territoryId?: string;
  assignedSrId?: string;
  dealerCode?: string;
  balanceMin?: Prisma.Decimal;
  balanceMax?: Prisma.Decimal;
  fromDate?: Date;
  toDate?: Date;
  includeZeroBalance?: boolean;
  includeAdvance?: boolean;
}

function buildBalanceConditions(
  params: ScopedDealerFilterParams,
): Prisma.DealerWhereInput[] {
  const conditions: Prisma.DealerWhereInput[] = [];

  if (params.balanceMin) {
    conditions.push({ currentBalance: { gte: params.balanceMin } });
  }
  if (params.balanceMax) {
    conditions.push({ currentBalance: { lte: params.balanceMax } });
  }

  if (!params.includeZeroBalance && !params.includeAdvance) {
    conditions.push({ currentBalance: { gt: ZERO } });
  } else if (!params.includeZeroBalance && params.includeAdvance) {
    conditions.push({ currentBalance: { not: ZERO } });
  } else if (params.includeZeroBalance && !params.includeAdvance) {
    conditions.push({ currentBalance: { gte: ZERO } });
  }

  return conditions;
}

export function buildScopedDealerWhere(
  params: ScopedDealerFilterParams,
  scope: TerritoryScope,
): Prisma.DealerWhereInput {
  const base: Prisma.DealerWhereInput = {
    isActive: true,
  };

  if (params.divisionId) {
    base.divisionId = params.divisionId;
  }
  if (params.districtId) {
    base.districtId = params.districtId;
  }
  if (params.territoryId) {
    base.territoryId = params.territoryId;
  }
  if (params.dealerCode) {
    base.dealerCode = params.dealerCode;
  }
  if (params.assignedSrId) {
    base.ownershipHistory = {
      some: {
        isActive: true,
        assignedSrId: params.assignedSrId,
      },
    };
  }

  if (params.fromDate || params.toDate) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (params.fromDate) {
      dateFilter.gte = params.fromDate;
    }
    if (params.toDate) {
      dateFilter.lte = params.toDate;
    }
    base.OR = [
      { lastInvoiceDate: dateFilter },
      { lastCollectionDate: dateFilter },
    ];
  }

  const balanceConditions = buildBalanceConditions(params);
  const scopedBase = mergeDealerTerritoryScope(base, scope);

  if (balanceConditions.length === 0) {
    return scopedBase;
  }

  return {
    AND: [scopedBase, ...balanceConditions],
  };
}

export async function findDealersForDueReport(
  client: DueReportReadClient,
  where: Prisma.DealerWhereInput,
  options?: { skip?: number; take?: number },
): Promise<DealerDueRow[]> {
  return client.dealer.findMany({
    where,
    select: dealerDueSelect,
    orderBy: [{ currentBalance: "desc" }, { dealerCode: "asc" }],
    skip: options?.skip,
    take: options?.take,
  });
}

export async function countDealersForDueReport(
  client: DueReportReadClient,
  where: Prisma.DealerWhereInput,
): Promise<number> {
  return client.dealer.count({ where });
}

export async function findDealerForDueReport(
  client: DueReportReadClient,
  dealerCode: string,
): Promise<DealerDueRow | null> {
  return client.dealer.findUnique({
    where: { dealerCode },
    select: dealerDueSelect,
  });
}

export async function checkDealerLedgerIntegrity(
  client: DueReportReadClient,
  dealerCode: string,
): Promise<boolean> {
  const snapshot = await reconcileDealerLedger(client, dealerCode);
  if (snapshot.entryCount === 0) {
    return snapshot.cachedBalance.equals(ZERO);
  }
  return snapshot.isReconciled;
}

export async function batchCheckLedgerIntegrity(
  client: DueReportReadClient,
  dealerCodes: readonly string[],
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  if (dealerCodes.length === 0) {
    return results;
  }

  const lastEntries = await client.ledgerEntry.findMany({
    where: { dealerCode: { in: [...dealerCodes] } },
    orderBy: [{ postingDate: "desc" }, { id: "desc" }],
    distinct: ["dealerCode"],
    select: {
      dealerCode: true,
      balance: true,
    },
  });

  const lastBalanceByCode = new Map(
    lastEntries.map((entry) => [entry.dealerCode, entry.balance]),
  );

  const dealers = await client.dealer.findMany({
    where: { dealerCode: { in: [...dealerCodes] } },
    select: { dealerCode: true, currentBalance: true },
  });

  for (const dealer of dealers) {
    const lastBalance = lastBalanceByCode.get(dealer.dealerCode);
    if (lastBalance === undefined) {
      results.set(dealer.dealerCode, dealer.currentBalance.equals(ZERO));
    } else {
      results.set(dealer.dealerCode, lastBalance.equals(dealer.currentBalance));
    }
  }

  return results;
}

export interface AgingInvoiceRow {
  id: string;
  dealerCode: string;
  dueDate: Date;
  issueDate: Date;
  grandTotal: Prisma.Decimal;
  collectionReceived: Prisma.Decimal;
  status: InvoiceStatus;
}

export async function findAgingInvoices(
  client: DueReportReadClient,
  dealerWhere: Prisma.DealerWhereInput,
): Promise<AgingInvoiceRow[]> {
  return client.invoice.findMany({
    where: {
      status: {
        in: [InvoiceStatus.Issued, InvoiceStatus.Partial, InvoiceStatus.Overdue],
      },
      dealer: dealerWhere,
    },
    select: {
      id: true,
      dealerCode: true,
      dueDate: true,
      issueDate: true,
      grandTotal: true,
      collectionReceived: true,
      status: true,
    },
  });
}

export async function findDealerCodesMatchingAgingBucket(
  client: DueReportReadClient,
  dealerWhere: Prisma.DealerWhereInput,
  bucket: AgingBucket,
  asOfDate: Date,
): Promise<Set<string>> {
  const invoices = await findAgingInvoices(client, dealerWhere);
  const matching = new Set<string>();

  for (const invoice of invoices) {
    if (!isAllocatableInvoiceStatus(invoice.status)) {
      continue;
    }
    const outstanding = computeInvoiceOutstanding(
      invoice.grandTotal,
      invoice.collectionReceived,
    );
    if (outstanding.lessThanOrEqualTo(ZERO)) {
      continue;
    }
    const daysOverdue = computeDaysOverdue(invoice.dueDate, asOfDate);
    if (classifyAgingBucket(daysOverdue) === bucket) {
      matching.add(invoice.dealerCode);
    }
  }

  return matching;
}

export function buildDueReportWhere(
  filters: DueReportFilters,
  scope: TerritoryScope,
): Prisma.DealerWhereInput {
  return buildScopedDealerWhere(filters, scope);
}

export function buildSummaryWhere(
  params: GetCompanyDueSummaryParams | GetTerritoryDueReportParams | GetSrDueReportParams | GetDueAgingReportParams,
  scope: TerritoryScope,
): Prisma.DealerWhereInput {
  return buildScopedDealerWhere(
    {
      ...params,
      includeZeroBalance: true,
      includeAdvance: true,
    },
    scope,
  );
}

export async function findAllDealersForAggregation(
  client: DueReportReadClient,
  where: Prisma.DealerWhereInput,
): Promise<DealerDueRow[]> {
  return findDealersForDueReport(client, where);
}

export interface OwnershipAtDateRow {
  dealerId: string;
  assignedSrId: string | null;
  assignedSrName: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export async function findOwnershipHistoriesForDealers(
  client: DueReportReadClient,
  dealerIds: readonly string[],
): Promise<OwnershipAtDateRow[]> {
  if (dealerIds.length === 0 || !client.dealerOwnershipHistory) {
    return [];
  }

  const rows = await client.dealerOwnershipHistory.findMany({
    where: { dealerId: { in: [...dealerIds] } },
    select: {
      dealerId: true,
      assignedSrId: true,
      assignedSr: { select: { name: true } },
      effectiveFrom: true,
      effectiveTo: true,
    },
    orderBy: { effectiveFrom: "desc" },
  });

  return rows.map((row) => ({
    dealerId: row.dealerId,
    assignedSrId: row.assignedSrId,
    assignedSrName: row.assignedSr?.name ?? null,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
  }));
}

export function resolveOwnershipAtDate(
  histories: readonly OwnershipAtDateRow[],
  dealerId: string,
  atDate: Date,
): OwnershipAtDateRow | null {
  return (
    histories.find(
      (row) =>
        row.dealerId === dealerId &&
        row.effectiveFrom <= atDate &&
        (row.effectiveTo === null || row.effectiveTo > atDate),
    ) ?? null
  );
}

export function groupDealersByTerritory(
  dealers: readonly DealerDueRow[],
  groupBy: TerritoryGroupBy,
): Map<string, { name: string; dealers: DealerDueRow[] }> {
  const groups = new Map<string, { name: string; dealers: DealerDueRow[] }>();

  for (const dealer of dealers) {
    let groupId: string;
    let groupName: string;

    switch (groupBy) {
      case "division":
        groupId = dealer.divisionId ?? "__unassigned__";
        groupName = dealer.division?.name ?? "Unassigned";
        break;
      case "district":
        groupId = dealer.districtId ?? "__unassigned__";
        groupName = dealer.geoDistrict?.name ?? "Unassigned";
        break;
      case "territory":
        groupId = dealer.territoryId ?? "__unassigned__";
        groupName = dealer.geoTerritory?.name ?? "Unassigned";
        break;
    }

    const existing = groups.get(groupId);
    if (existing) {
      existing.dealers.push(dealer);
    } else {
      groups.set(groupId, { name: groupName, dealers: [dealer] });
    }
  }

  return groups;
}

export function groupDealersBySr(
  dealers: readonly DealerDueRow[],
): Map<string | null, { name: string | null; dealers: DealerDueRow[] }> {
  const groups = new Map<
    string | null,
    { name: string | null; dealers: DealerDueRow[] }
  >();

  for (const dealer of dealers) {
    const ownership = dealer.ownershipHistory[0];
    const srId = ownership?.assignedSr?.id ?? null;
    const srName = ownership?.assignedSr?.name ?? null;

    const existing = groups.get(srId);
    if (existing) {
      existing.dealers.push(dealer);
    } else {
      groups.set(srId, { name: srName, dealers: [dealer] });
    }
  }

  return groups;
}
