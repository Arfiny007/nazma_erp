import {
  CollectionStatus,
  InvoiceStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { aggregateTerritoryDue } from "@/lib/dashboard/analytics/analytics-query";
import type { AnalyticsReadClient } from "@/lib/dashboard/analytics/analytics-query";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import type { TerritoryScope } from "@/lib/rbac/territory";
import {
  mergeCollectionTerritoryScope,
  mergeDealerTerritoryScope,
} from "@/lib/rbac/territory";

import {
  buildTerritoryMapNode,
  emptyMetricsForTerritory,
  extractDistrictOptions,
  extractDivisionOptions,
  type TerritoryGeoRow,
  type TerritoryMetricRow,
} from "./map-mappers";
import type {
  TerritoryMapFilters,
  TerritoryMapPayload,
} from "./map-types";
import {
  assertMapScope,
  buildMapContext,
  parseMapFilters,
  resolvePeriodRange,
  sortNodesByMetric,
} from "./map-validation";

/**
 * Territory map service — PHASE_09C.
 *
 * Presentation-only. Reuses analytics aggregation paths.
 * Batched Prisma queries — no N+1 per territory.
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

export type MapReadClient = AnalyticsReadClient & {
  userTerritoryAssignment?: Pick<
    Prisma.TransactionClient["userTerritoryAssignment"],
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

async function loadTerritoriesWithGeo(
  scope: TerritoryScope,
  filters: TerritoryMapFilters,
  client: MapReadClient,
): Promise<TerritoryGeoRow[]> {
  const where: Prisma.TerritoryWhereInput = {
    isActive: true,
    ...(scope.mode === "TERRITORIES"
      ? { id: { in: [...scope.territoryIds] } }
      : {}),
    ...(filters.districtId ? { districtId: filters.districtId } : {}),
    ...(filters.divisionId
      ? { district: { divisionId: filters.divisionId } }
      : {}),
  };

  return client.territory.findMany({
    where,
    select: {
      id: true,
      name: true,
      district: {
        select: {
          id: true,
          name: true,
          divisionId: true,
          division: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ district: { division: { sortOrder: "asc" } } }, { name: "asc" }],
  });
}

async function batchTerritorySales(
  scope: TerritoryScope,
  from: Date,
  to: Date,
  client: MapReadClient,
): Promise<Map<string, Prisma.Decimal>> {
  const invoices = await client.invoice.findMany({
    where: mergeInvoiceTerritoryScope(
      {
        status: { in: ISSUED_INVOICE_STATUSES },
        issueDate: { gte: from, lte: to },
      },
      scope,
    ),
    select: {
      grandTotal: true,
      dealer: { select: { territoryId: true } },
    },
  });

  const map = new Map<string, Prisma.Decimal>();
  for (const inv of invoices) {
    const tid = inv.dealer.territoryId;
    if (!tid) continue;
    map.set(tid, (map.get(tid) ?? ZERO).plus(inv.grandTotal));
  }
  return map;
}

async function batchTerritoryCollections(
  scope: TerritoryScope,
  from: Date,
  to: Date,
  client: MapReadClient,
): Promise<Map<string, Prisma.Decimal>> {
  const collections = await client.collection.findMany({
    where: mergeCollectionTerritoryScope(
      {
        status: { in: CONFIRMED_COLLECTION_STATUSES },
        collectionDate: { gte: from, lte: to },
      },
      scope,
    ),
    select: {
      receivedAmount: true,
      dealer: { select: { territoryId: true } },
    },
  });

  const map = new Map<string, Prisma.Decimal>();
  for (const col of collections) {
    const tid = col.dealer.territoryId;
    if (!tid) continue;
    map.set(tid, (map.get(tid) ?? ZERO).plus(col.receivedAmount));
  }
  return map;
}

async function batchDealerCounts(
  scope: TerritoryScope,
  territoryIds: string[],
  client: MapReadClient,
): Promise<Map<string, number>> {
  if (territoryIds.length === 0) {
    return new Map();
  }

  const rows = await client.dealer.groupBy({
    by: ["territoryId"],
    where: mergeDealerTerritoryScope(
      {
        isActive: true,
        territoryId: { in: territoryIds },
      },
      scope,
    ),
    _count: { id: true },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.territoryId) {
      map.set(row.territoryId, row._count.id);
    }
  }
  return map;
}

async function batchSrCounts(
  territoryIds: string[],
  client: MapReadClient,
): Promise<Map<string, number>> {
  if (territoryIds.length === 0 || !client.userTerritoryAssignment) {
    return new Map();
  }

  const rows = await client.userTerritoryAssignment.findMany({
    where: {
      isActive: true,
      territoryId: { in: territoryIds },
      user: { role: "SR", isActive: true },
    },
    select: { territoryId: true },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.territoryId, (map.get(row.territoryId) ?? 0) + 1);
  }
  return map;
}

async function buildTerritoryMetrics(
  scope: TerritoryScope,
  territoryIds: string[],
  from: Date,
  to: Date,
  client: MapReadClient,
): Promise<Map<string, TerritoryMetricRow>> {
  const [salesMap, collectionsMap, dueMap, dealerCounts, srCounts] =
    await Promise.all([
      batchTerritorySales(scope, from, to, client),
      batchTerritoryCollections(scope, from, to, client),
      aggregateTerritoryDue(scope, client),
      batchDealerCounts(scope, territoryIds, client),
      batchSrCounts(territoryIds, client),
    ]);

  const result = new Map<string, TerritoryMetricRow>();
  for (const tid of territoryIds) {
    const dueEntry = dueMap.get(tid);
    result.set(tid, {
      territoryId: tid,
      sales: salesMap.get(tid) ?? ZERO,
      collections: collectionsMap.get(tid) ?? ZERO,
      due: dueEntry?.due ?? ZERO,
      dealerCount: dealerCounts.get(tid) ?? 0,
      srCount: srCounts.get(tid) ?? 0,
    });
  }
  return result;
}

async function loadMapPayload(
  userId: string,
  role: TerritoryMapPayload["role"],
  filtersInput?: Partial<TerritoryMapFilters>,
  client: MapReadClient = prisma as MapReadClient,
): Promise<TerritoryMapPayload> {
  buildMapContext(userId, role);
  const filters = parseMapFilters(filtersInput);
  const generatedAt = new Date();
  const scope = await buildTerritoryScope(userId);
  assertMapScope(scope);

  const { from, to } = resolvePeriodRange(filters.period, generatedAt);
  const territories = await loadTerritoriesWithGeo(scope, filters, client);
  const territoryIds = territories.map((t) => t.id);

  const metricsMap = await buildTerritoryMetrics(
    scope,
    territoryIds,
    from,
    to,
    client,
  );

  const nodes = territories.map((geo) => {
    const metrics =
      metricsMap.get(geo.id) ?? emptyMetricsForTerritory(geo.id);
    return buildTerritoryMapNode(geo, metrics);
  });

  const allTerritories = await loadTerritoriesWithGeo(
    scope,
    { ...filters, divisionId: undefined, districtId: undefined },
    client,
  );

  return {
    role,
    nodes: sortNodesByMetric(nodes, filters.metric),
    divisions: extractDivisionOptions(allTerritories),
    districts: extractDistrictOptions(allTerritories),
    filters,
    generatedAt: generatedAt.toISOString(),
  };
}

export async function getSrTerritoryMap(
  userId: string,
  filters?: Partial<TerritoryMapFilters>,
  client?: MapReadClient,
): Promise<TerritoryMapPayload> {
  return loadMapPayload(userId, "SR", filters, client);
}

export async function getManagerTerritoryMap(
  userId: string,
  filters?: Partial<TerritoryMapFilters>,
  client?: MapReadClient,
): Promise<TerritoryMapPayload> {
  return loadMapPayload(userId, "Manager", filters, client);
}

export async function getAccountsTerritoryMap(
  userId: string,
  filters?: Partial<TerritoryMapFilters>,
  client?: MapReadClient,
): Promise<TerritoryMapPayload> {
  return loadMapPayload(userId, "Accounts", filters, client);
}

export async function getAdminTerritoryMap(
  userId: string,
  filters?: Partial<TerritoryMapFilters>,
  client?: MapReadClient,
): Promise<TerritoryMapPayload> {
  return loadMapPayload(userId, "Super_Admin", filters, client);
}

export async function resolveTerritoryMapForRole(
  userId: string,
  role: import("@prisma/client").UserRole,
  filters?: Partial<TerritoryMapFilters>,
  client?: MapReadClient,
): Promise<TerritoryMapPayload> {
  const mapRole = buildMapContext(userId, role).role;

  switch (mapRole) {
    case "SR":
      return getSrTerritoryMap(userId, filters, client);
    case "Manager":
      return getManagerTerritoryMap(userId, filters, client);
    case "Accounts":
      return getAccountsTerritoryMap(userId, filters, client);
    case "Super_Admin":
      return getAdminTerritoryMap(userId, filters, client);
    default:
      return getAdminTerritoryMap(userId, filters, client);
  }
}
