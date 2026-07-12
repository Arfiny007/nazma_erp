import {
  CollectionStatus,
  InvoiceStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildScopedDealerWhere,
  findAgingInvoices,
  findAllDealersForAggregation,
  type DueReportReadClient,
} from "@/lib/reports/due/due-report-query";
import { accumulateInvoiceAging } from "@/lib/reports/due/due-aging";
import type { TerritoryScope } from "@/lib/rbac/territory";
import {
  mergeCollectionTerritoryScope,
  mergeDealerTerritoryScope,
} from "@/lib/rbac/territory";
import {
  aggregateCollections,
  aggregateInvoiceSales,
  type DashboardReadClient,
} from "@/lib/dashboard/dashboard-query";

import { monthRange } from "./analytics-validation";
import { DEFAULT_TREND_MONTHS } from "./analytics-types";

/**
 * Read-only analytics queries — PHASE_09B.
 *
 * Uses Prisma aggregate / batching. Due totals read via due engine paths only.
 */

const ZERO = new Prisma.Decimal(0);

export type AnalyticsReadClient = DashboardReadClient & DueReportReadClient;

const ISSUED_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.Issued,
  InvoiceStatus.Paid,
  InvoiceStatus.Partial,
  InvoiceStatus.Overdue,
];

function mergeInvoiceTerritoryScope(
  base: Prisma.InvoiceWhereInput,
  scope: TerritoryScope,
): Prisma.InvoiceWhereInput {
  if (scope.mode === "ALL") {
    return base;
  }
  if (scope.mode === "NONE") {
    return { AND: [base, { dealer: { territoryId: { in: [] } } }] };
  }
  return {
    AND: [base, { dealer: { territoryId: { in: [...scope.territoryIds] } } }],
  };
}

export async function buildMonthlyDecimalTrend(
  scope: TerritoryScope,
  months: number,
  aggregator: (
    scope: TerritoryScope,
    from: Date,
    to: Date,
    client: AnalyticsReadClient,
  ) => Promise<Prisma.Decimal>,
  asOf: Date = new Date(),
  client: AnalyticsReadClient = prisma,
): Promise<{ label: string; amount: Prisma.Decimal }[]> {
  const ranges = Array.from({ length: months }, (_, index) =>
    monthRange(asOf, months, months - 1 - index),
  );

  const amounts = await Promise.all(
    ranges.map((range) => aggregator(scope, range.start, range.end, client)),
  );

  return ranges.map((range, index) => ({
    label: range.label,
    amount: amounts[index] ?? ZERO,
  }));
}

export async function buildMonthlySalesTrend(
  scope: TerritoryScope,
  months: number = DEFAULT_TREND_MONTHS,
  asOf: Date = new Date(),
  client: AnalyticsReadClient = prisma,
) {
  return buildMonthlyDecimalTrend(
    scope,
    months,
    (s, from, to, c) => aggregateInvoiceSales(s, from, to, c),
    asOf,
    client,
  );
}

export async function buildMonthlyCollectionTrend(
  scope: TerritoryScope,
  months: number = DEFAULT_TREND_MONTHS,
  asOf: Date = new Date(),
  client: AnalyticsReadClient = prisma,
) {
  return buildMonthlyDecimalTrend(
    scope,
    months,
    (s, from, to, c) => aggregateCollections(s, from, to, c),
    asOf,
    client,
  );
}

/**
 * Outstanding trend — invoice-level outstanding via due engine invoice reads.
 * Reads `Invoice.currentDue` only; never mutates dealer balances.
 */
export async function buildMonthlyOutstandingTrend(
  scope: TerritoryScope,
  months: number = DEFAULT_TREND_MONTHS,
  asOf: Date = new Date(),
  client: AnalyticsReadClient = prisma,
) {
  const ranges = Array.from({ length: months }, (_, index) =>
    monthRange(asOf, months, months - 1 - index),
  );

  const amounts = await Promise.all(
    ranges.map(async (range) => {
      const invoices = await client.invoice.findMany({
        where: mergeInvoiceTerritoryScope(
          {
            status: { in: ISSUED_INVOICE_STATUSES },
            issueDate: { gte: range.start, lte: range.end },
            currentDue: { gt: ZERO },
          },
          scope,
        ),
        select: { currentDue: true },
      });

      return invoices.reduce(
        (sum, row) => sum.plus(row.currentDue),
        ZERO,
      );
    }),
  );

  return ranges.map((range, index) => ({
    label: range.label,
    amount: amounts[index] ?? ZERO,
  }));
}

export async function buildMonthlyDealerGrowthTrend(
  scope: TerritoryScope,
  months: number = DEFAULT_TREND_MONTHS,
  asOf: Date = new Date(),
  client: AnalyticsReadClient = prisma,
) {
  const ranges = Array.from({ length: months }, (_, index) =>
    monthRange(asOf, months, months - 1 - index),
  );

  const counts = await Promise.all(
    ranges.map((range) =>
      client.dealer.count({
        where: mergeDealerTerritoryScope(
          {
            isActive: true,
            createdAt: { gte: range.start, lte: range.end },
          },
          scope,
        ),
      }),
    ),
  );

  return ranges.map((range, index) => ({
    label: range.label,
    count: counts[index] ?? 0,
  }));
}

export async function aggregateTerritorySalesCollections(
  scope: TerritoryScope,
  fromDate: Date,
  toDate: Date,
  client: AnalyticsReadClient = prisma,
) {
  const territories = await client.territory.findMany({
    where: {
      isActive: true,
      ...(scope.mode === "TERRITORIES"
        ? { id: { in: [...scope.territoryIds] } }
        : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const territoryScope = (territoryId: string): TerritoryScope => ({
    mode: "TERRITORIES",
    territoryIds: [territoryId],
  });

  const rows = await Promise.all(
    territories.map(async (territory) => {
      const scoped = territoryScope(territory.id);
      const [sales, collections] = await Promise.all([
        aggregateInvoiceSales(scoped, fromDate, toDate, client),
        aggregateCollections(scoped, fromDate, toDate, client),
      ]);
      return {
        territoryId: territory.id,
        territoryName: territory.name,
        sales,
        collections,
      };
    }),
  );

  return rows;
}

export async function aggregateTerritoryDue(
  scope: TerritoryScope,
  client: AnalyticsReadClient = prisma,
) {
  const dealerWhere = buildScopedDealerWhere(
    { includeZeroBalance: true, includeAdvance: true },
    scope,
  );
  const dealers = await findAllDealersForAggregation(client, dealerWhere);
  const byTerritory = new Map<
    string,
    { name: string; due: Prisma.Decimal }
  >();

  for (const dealer of dealers) {
    const territoryId = dealer.territoryId ?? "unassigned";
    const territoryName = dealer.geoTerritory?.name ?? "Unassigned";
    const balance = dealer.currentBalance;
    if (balance.lessThanOrEqualTo(ZERO)) {
      continue;
    }
    const existing = byTerritory.get(territoryId) ?? {
      name: territoryName,
      due: ZERO,
    };
    existing.due = existing.due.plus(balance);
    byTerritory.set(territoryId, existing);
  }

  return byTerritory;
}

export interface SrLeaderboardMetrics {
  srId: string;
  srName: string;
  sales: Prisma.Decimal;
  collections: Prisma.Decimal;
  outstandingDue: Prisma.Decimal;
}

/**
 * SR leaderboard — sales/collections via ownership history at invoice/collection date.
 */
export async function buildSrLeaderboardMetrics(
  scope: TerritoryScope,
  fromDate: Date,
  toDate: Date,
  limit: number = 8,
  client: AnalyticsReadClient = prisma,
): Promise<SrLeaderboardMetrics[]> {
  const dealerWhere = buildScopedDealerWhere(
    { includeZeroBalance: true, includeAdvance: true },
    scope,
  );
  const dealers = await findAllDealersForAggregation(client, dealerWhere);
  const dealerIds = dealers.map((d) => d.id);

  const ownershipHistories =
    client.dealerOwnershipHistory
      ? await client.dealerOwnershipHistory.findMany({
          where: { dealerId: { in: dealerIds } },
          select: {
            dealerId: true,
            assignedSrId: true,
            effectiveFrom: true,
            effectiveTo: true,
            assignedSr: { select: { id: true, name: true } },
          },
        })
      : [];

  const resolveSrAt = (dealerCode: string, at: Date) => {
    const dealer = dealers.find((d) => d.dealerCode === dealerCode);
    if (!dealer) return null;
    const histories = ownershipHistories.filter(
      (h) =>
        h.dealerId === dealer.id &&
        h.effectiveFrom <= at &&
        (h.effectiveTo === null || h.effectiveTo >= at),
    );
    histories.sort(
      (a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime(),
    );
    return histories[0]?.assignedSr ?? null;
  };

  const metrics = new Map<
    string,
    { name: string; sales: Prisma.Decimal; collections: Prisma.Decimal; due: Prisma.Decimal }
  >();

  const [invoices, collections] = await Promise.all([
    client.invoice.findMany({
      where: mergeInvoiceTerritoryScope(
        {
          status: { in: ISSUED_INVOICE_STATUSES },
          issueDate: { gte: fromDate, lte: toDate },
        },
        scope,
      ),
      select: {
        dealerCode: true,
        grandTotal: true,
        issueDate: true,
      },
    }),
    client.collection.findMany({
      where: mergeCollectionTerritoryScope(
        {
          status: {
            in: [
              CollectionStatus.Confirmed,
              CollectionStatus.PartiallyAllocated,
              CollectionStatus.Allocated,
            ],
          },
          collectionDate: { gte: fromDate, lte: toDate },
        },
        scope,
      ),
      select: {
        dealerCode: true,
        receivedAmount: true,
        collectionDate: true,
      },
    }),
  ]);

  for (const invoice of invoices) {
    const sr = resolveSrAt(invoice.dealerCode, invoice.issueDate);
    if (!sr) continue;
    const row = metrics.get(sr.id) ?? {
      name: sr.name,
      sales: ZERO,
      collections: ZERO,
      due: ZERO,
    };
    row.sales = row.sales.plus(invoice.grandTotal);
    metrics.set(sr.id, row);
  }

  for (const collection of collections) {
    const sr = resolveSrAt(collection.dealerCode, collection.collectionDate);
    if (!sr) continue;
    const row = metrics.get(sr.id) ?? {
      name: sr.name,
      sales: ZERO,
      collections: ZERO,
      due: ZERO,
    };
    row.collections = row.collections.plus(collection.receivedAmount);
    metrics.set(sr.id, row);
  }

  for (const dealer of dealers) {
    if (dealer.currentBalance.lessThanOrEqualTo(ZERO)) continue;
    const sr = dealer.ownershipHistory[0]?.assignedSr;
    if (!sr) continue;
    const row = metrics.get(sr.id) ?? {
      name: sr.name,
      sales: ZERO,
      collections: ZERO,
      due: ZERO,
    };
    row.due = row.due.plus(dealer.currentBalance);
    metrics.set(sr.id, row);
  }

  return [...metrics.entries()]
    .map(([srId, row]) => ({
      srId,
      srName: row.name,
      sales: row.sales,
      collections: row.collections,
      outstandingDue: row.due,
    }))
    .sort((a, b) => b.sales.minus(a.sales).toNumber())
    .slice(0, limit);
}

export async function buildRiskDealerAgingBuckets(
  scope: TerritoryScope,
  limit: number = 8,
  asOf: Date = new Date(),
  client: AnalyticsReadClient = prisma,
) {
  const dealerWhere = buildScopedDealerWhere(
    { includeZeroBalance: false, includeAdvance: false },
    scope,
  );
  const dealers = await findAllDealersForAggregation(client, dealerWhere);

  const topDealers = [...dealers]
    .filter((d) => d.currentBalance.gt(ZERO))
    .sort((a, b) => b.currentBalance.minus(a.currentBalance).toNumber())
    .slice(0, limit);

  const invoices = await findAgingInvoices(client, dealerWhere);
  const agingByDealer = new Map<string, ReturnType<typeof accumulateInvoiceAging>>();

  for (const dealer of topDealers) {
    const dealerInvoices = invoices.filter((inv) => inv.dealerCode === dealer.dealerCode);
    agingByDealer.set(
      dealer.dealerCode,
      accumulateInvoiceAging(dealerInvoices, asOf),
    );
  }

  return topDealers.map((dealer) => ({
    dealerCode: dealer.dealerCode,
    dealerName: dealer.companyName,
    currentBalance: dealer.currentBalance,
    aging: agingByDealer.get(dealer.dealerCode)!,
  }));
}

export async function buildMonthlyCollectionEfficiency(
  scope: TerritoryScope,
  months: number = DEFAULT_TREND_MONTHS,
  asOf: Date = new Date(),
  client: AnalyticsReadClient = prisma,
) {
  const [salesTrend, collectionTrend] = await Promise.all([
    buildMonthlySalesTrend(scope, months, asOf, client),
    buildMonthlyCollectionTrend(scope, months, asOf, client),
  ]);

  return salesTrend.map((sales, index) => {
    const collections = collectionTrend[index]?.amount ?? ZERO;
    const ratio = sales.amount.isZero()
      ? 0
      : collections.div(sales.amount).mul(100).toNumber();
    return {
      label: sales.label,
      ratio: Math.min(Math.max(ratio, 0), 100),
    };
  });
}

export async function countTerritoriesCreatedBetween(
  fromDate: Date,
  toDate: Date,
  client: AnalyticsReadClient = prisma,
): Promise<number> {
  return client.territory.count({
    where: { createdAt: { gte: fromDate, lte: toDate } },
  });
}

export async function countUsersCreatedBetween(
  fromDate: Date,
  toDate: Date,
  client: AnalyticsReadClient = prisma,
): Promise<number> {
  return client.user.count({
    where: { createdAt: { gte: fromDate, lte: toDate } },
  });
}

export async function buildMonthlyTerritoryGrowth(
  months: number = DEFAULT_TREND_MONTHS,
  asOf: Date = new Date(),
  client: AnalyticsReadClient = prisma,
) {
  const ranges = Array.from({ length: months }, (_, index) =>
    monthRange(asOf, months, months - 1 - index),
  );

  const counts = await Promise.all(
    ranges.map((range) =>
      countTerritoriesCreatedBetween(range.start, range.end, client),
    ),
  );

  return ranges.map((range, index) => ({
    label: range.label,
    count: counts[index] ?? 0,
  }));
}

export async function buildMonthlyUserGrowth(
  months: number = DEFAULT_TREND_MONTHS,
  asOf: Date = new Date(),
  client: AnalyticsReadClient = prisma,
) {
  const ranges = Array.from({ length: months }, (_, index) =>
    monthRange(asOf, months, months - 1 - index),
  );

  const counts = await Promise.all(
    ranges.map((range) =>
      countUsersCreatedBetween(range.start, range.end, client),
    ),
  );

  return ranges.map((range, index) => ({
    label: range.label,
    count: counts[index] ?? 0,
  }));
}
