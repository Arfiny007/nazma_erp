import {
  CollectionStatus,
  InvoiceStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { TerritoryScope } from "@/lib/rbac/territory";
import {
  mergeCollectionTerritoryScope,
  mergeDealerTerritoryScope,
  mergeOrderTerritoryScope,
} from "@/lib/rbac/territory";

import {
  endOfPreviousMonth,
  startOfDay,
  startOfMonth,
  startOfPreviousMonth,
} from "./dashboard-validation";

/**
 * Read-only Prisma queries for dashboard presentation metrics — PHASE_09A.
 *
 * Invoice sales and collection totals are operational aggregates only.
 * Due/receivable totals MUST come from the Due Report engine.
 */

const ZERO = new Prisma.Decimal(0);

const ISSUED_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.Issued,
  InvoiceStatus.Paid,
  InvoiceStatus.Partial,
  InvoiceStatus.Overdue,
];

const CONFIRMED_COLLECTION_STATUSES: CollectionStatus[] = [
  CollectionStatus.Confirmed,
  CollectionStatus.PartiallyAllocated,
  CollectionStatus.Allocated,
];

export type DashboardReadClient = Pick<
  Prisma.TransactionClient,
  | "dealer"
  | "invoice"
  | "collection"
  | "user"
  | "territory"
  | "salesOrder"
  | "ledgerEntry"
> & {
  dealerOwnershipHistory?: Pick<
    Prisma.TransactionClient["dealerOwnershipHistory"],
    "findMany"
  >;
};

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

function issuedInvoiceWhere(
  scope: TerritoryScope,
  fromDate: Date,
  toDate?: Date,
): Prisma.InvoiceWhereInput {
  const base: Prisma.InvoiceWhereInput = {
    status: { in: ISSUED_INVOICE_STATUSES },
    issueDate: toDate ? { gte: fromDate, lte: toDate } : { gte: fromDate },
  };
  return mergeInvoiceTerritoryScope(base, scope);
}

function confirmedCollectionWhere(
  scope: TerritoryScope,
  fromDate: Date,
  toDate?: Date,
): Prisma.CollectionWhereInput {
  const base: Prisma.CollectionWhereInput = {
    status: { in: CONFIRMED_COLLECTION_STATUSES },
    collectionDate: toDate ? { gte: fromDate, lte: toDate } : { gte: fromDate },
  };
  return mergeCollectionTerritoryScope(base, scope);
}

export async function aggregateInvoiceSales(
  scope: TerritoryScope,
  fromDate: Date,
  toDate?: Date,
  client: DashboardReadClient = prisma,
): Promise<Prisma.Decimal> {
  const result = await client.invoice.aggregate({
    where: issuedInvoiceWhere(scope, fromDate, toDate),
    _sum: { grandTotal: true },
  });
  return result._sum.grandTotal ?? ZERO;
}

export async function aggregateCollections(
  scope: TerritoryScope,
  fromDate: Date,
  toDate?: Date,
  client: DashboardReadClient = prisma,
): Promise<Prisma.Decimal> {
  const result = await client.collection.aggregate({
    where: confirmedCollectionWhere(scope, fromDate, toDate),
    _sum: { receivedAmount: true },
  });
  return result._sum.receivedAmount ?? ZERO;
}

export async function countScopedDealers(
  scope: TerritoryScope,
  client: DashboardReadClient = prisma,
): Promise<number> {
  return client.dealer.count({
    where: mergeDealerTerritoryScope({ isActive: true }, scope),
  });
}

export async function countPendingInvoices(
  scope: TerritoryScope,
  client: DashboardReadClient = prisma,
): Promise<number> {
  const draftCount = await client.invoice.count({
    where: mergeInvoiceTerritoryScope({ status: InvoiceStatus.Draft }, scope),
  });

  const unpaidCount = await client.invoice.count({
    where: mergeInvoiceTerritoryScope(
      {
        status: {
          in: [
            InvoiceStatus.Issued,
            InvoiceStatus.Partial,
            InvoiceStatus.Overdue,
          ],
        },
        currentDue: { gt: ZERO },
      },
      scope,
    ),
  });

  return draftCount + unpaidCount;
}

export async function countPendingAllocations(
  scope: TerritoryScope,
  client: DashboardReadClient = prisma,
): Promise<number> {
  return client.collection.count({
    where: mergeCollectionTerritoryScope(
      {
        status: {
          in: [CollectionStatus.Confirmed, CollectionStatus.PartiallyAllocated],
        },
        unallocatedAmount: { gt: ZERO },
      },
      scope,
    ),
  });
}

export async function findPendingAllocationRows(
  scope: TerritoryScope,
  limit: number,
  client: DashboardReadClient = prisma,
) {
  return client.collection.findMany({
    where: mergeCollectionTerritoryScope(
      {
        status: {
          in: [CollectionStatus.Confirmed, CollectionStatus.PartiallyAllocated],
        },
        unallocatedAmount: { gt: ZERO },
      },
      scope,
    ),
    select: {
      id: true,
      collectionNo: true,
      dealerCode: true,
      unallocatedAmount: true,
      collectionDate: true,
      dealer: { select: { companyName: true } },
    },
    orderBy: { collectionDate: "desc" },
    take: limit,
  });
}

export async function countTerritories(
  client: DashboardReadClient = prisma,
): Promise<number> {
  return client.territory.count({ where: { isActive: true } });
}

export async function countActiveUsers(
  client: DashboardReadClient = prisma,
): Promise<number> {
  return client.user.count({ where: { isActive: true } });
}

export async function countDealersCreatedBetween(
  fromDate: Date,
  toDate: Date,
  client: DashboardReadClient = prisma,
): Promise<number> {
  return client.dealer.count({
    where: {
      isActive: true,
      createdAt: { gte: fromDate, lte: toDate },
    },
  });
}

export interface RecentActivityRecord {
  id: string;
  type: "invoice" | "collection" | "order";
  reference: string;
  amount: Prisma.Decimal | null;
  occurredAt: Date;
  href: string;
}

export async function findRecentActivity(
  scope: TerritoryScope,
  limit: number,
  client: DashboardReadClient = prisma,
): Promise<RecentActivityRecord[]> {
  const perType = Math.ceil(limit / 3);

  const [invoices, collections, orders] = await Promise.all([
    client.invoice.findMany({
      where: mergeInvoiceTerritoryScope(
        { status: { in: ISSUED_INVOICE_STATUSES } },
        scope,
      ),
      select: {
        id: true,
        invoiceNo: true,
        grandTotal: true,
        issueDate: true,
      },
      orderBy: { issueDate: "desc" },
      take: perType,
    }),
    client.collection.findMany({
      where: mergeCollectionTerritoryScope(
        { status: { in: CONFIRMED_COLLECTION_STATUSES } },
        scope,
      ),
      select: {
        id: true,
        collectionNo: true,
        receivedAmount: true,
        collectionDate: true,
      },
      orderBy: { collectionDate: "desc" },
      take: perType,
    }),
    client.salesOrder.findMany({
      where: mergeOrderTerritoryScope({}, scope),
      select: {
        id: true,
        orderNo: true,
        grandTotal: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: perType,
    }),
  ]);

  const activity: RecentActivityRecord[] = [
    ...invoices.map((row) => ({
      id: `invoice-${row.id}`,
      type: "invoice" as const,
      reference: row.invoiceNo,
      amount: row.grandTotal,
      occurredAt: row.issueDate,
      href: `/invoices/${row.id}`,
    })),
    ...collections.map((row) => ({
      id: `collection-${row.id}`,
      type: "collection" as const,
      reference: row.collectionNo,
      amount: row.receivedAmount,
      occurredAt: row.collectionDate,
      href: `/collections/${row.id}`,
    })),
    ...orders.map((row) => ({
      id: `order-${row.id}`,
      type: "order" as const,
      reference: row.orderNo,
      amount: row.grandTotal,
      occurredAt: row.createdAt,
      href: `/orders/${row.id}`,
    })),
  ];

  activity.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  return activity.slice(0, limit);
}

export interface DashboardOperationalMetrics {
  todaySales: Prisma.Decimal;
  monthlySales: Prisma.Decimal;
  monthlyCollections: Prisma.Decimal;
  dealerCount: number;
  pendingInvoices: number;
  pendingAllocations: number;
  territoryCount: number;
  userCount: number;
  newDealersThisMonth: number;
  newDealersLastMonth: number;
}

/** Batched operational metrics — excludes due totals (due engine owns those). */
export async function loadOperationalMetrics(
  scope: TerritoryScope,
  asOf: Date = new Date(),
  client: DashboardReadClient = prisma,
): Promise<DashboardOperationalMetrics> {
  const todayStart = startOfDay(asOf);
  const monthStart = startOfMonth(asOf);
  const prevMonthStart = startOfPreviousMonth(asOf);
  const prevMonthEnd = endOfPreviousMonth(asOf);

  const [
    todaySales,
    monthlySales,
    monthlyCollections,
    dealerCount,
    pendingInvoices,
    pendingAllocations,
    territoryCount,
    userCount,
    newDealersThisMonth,
    newDealersLastMonth,
  ] = await Promise.all([
    aggregateInvoiceSales(scope, todayStart, asOf, client),
    aggregateInvoiceSales(scope, monthStart, asOf, client),
    aggregateCollections(scope, monthStart, asOf, client),
    countScopedDealers(scope, client),
    countPendingInvoices(scope, client),
    countPendingAllocations(scope, client),
    countTerritories(client),
    countActiveUsers(client),
    countDealersCreatedBetween(monthStart, asOf, client),
    countDealersCreatedBetween(prevMonthStart, prevMonthEnd, client),
  ]);

  return {
    todaySales,
    monthlySales,
    monthlyCollections,
    dealerCount,
    pendingInvoices,
    pendingAllocations,
    territoryCount,
    userCount,
    newDealersThisMonth,
    newDealersLastMonth,
  };
}
