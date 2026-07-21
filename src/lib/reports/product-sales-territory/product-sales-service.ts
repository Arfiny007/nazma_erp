import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { TerritoryScope } from "@/lib/rbac/territory";

import { compareQuantityDescThenName } from "./product-sales-calculations";
import {
  aggregateTerritoryProductSales,
  countDistinctInvoicesAndDealers,
  findCategoryOptions,
  findProductOptions,
  findTerritoryOptionsForScope,
  sumSoldQuantity,
  type ProductSalesReadClient,
} from "./product-sales-query";
import type {
  ProductSalesFilterParams,
  ProductSalesSort,
  TerritoryProductSalesReport,
  TerritoryProductSalesRow,
  TerritorySubtotal,
  TopSellingProductsChart,
} from "./product-sales-types";
import {
  assertScopedReportAccess,
  assertTerritoryInScope,
  buildProductSalesQuery,
  formatLocalDateOnly,
  normalizeFilters,
  toExclusiveDateBounds,
} from "./product-sales-validation";

/**
 * Territory Product Sales orchestration — PHASE_12B / ADR-061.
 * Read-only. Never mutates invoices, products, ownership, or ledger.
 */

function buildTerritoryNameMap(
  territories: ReadonlyArray<{ id: string; name: string }>,
): Map<string, string> {
  return new Map(territories.map((t) => [t.id, t.name]));
}

function applyRanksAndSort(
  aggregates: Awaited<
    ReturnType<typeof aggregateTerritoryProductSales>
  >["rows"],
  territoryNames: Map<string, string>,
  sortMode: ProductSalesSort,
  view: "territory-product" | "product-territory",
): TerritoryProductSalesRow[] {
  const withNames: TerritoryProductSalesRow[] = aggregates.map((row) => ({
    ...row,
    territoryName: territoryNames.get(row.territoryId) ?? row.territoryId,
    territoryRank: 0,
    overallRank: 0,
  }));

  const overallSorted = [...withNames].sort(compareQuantityDescThenName);
  const overallRankByKey = new Map<string, number>();
  let overallRank = 0;
  let prevOverall: (typeof overallSorted)[number] | null = null;
  for (const row of overallSorted) {
    if (
      !prevOverall ||
      !row.soldQuantity.equals(prevOverall.soldQuantity) ||
      row.productName !== prevOverall.productName ||
      row.productId !== prevOverall.productId ||
      row.territoryId !== prevOverall.territoryId
    ) {
      overallRank += 1;
    }
    overallRankByKey.set(`${row.territoryId}:${row.productId}`, overallRank);
    prevOverall = row;
  }

  const byTerritory = new Map<string, TerritoryProductSalesRow[]>();
  for (const row of withNames) {
    const list = byTerritory.get(row.territoryId) ?? [];
    list.push(row);
    byTerritory.set(row.territoryId, list);
  }

  const territoryRankByKey = new Map<string, number>();
  for (const [, list] of byTerritory) {
    const sorted = [...list].sort(compareQuantityDescThenName);
    let rank = 0;
    let prev: (typeof sorted)[number] | null = null;
    for (const row of sorted) {
      if (
        !prev ||
        !row.soldQuantity.equals(prev.soldQuantity) ||
        row.productName !== prev.productName ||
        row.productId !== prev.productId
      ) {
        rank += 1;
      }
      territoryRankByKey.set(`${row.territoryId}:${row.productId}`, rank);
      prev = row;
    }
  }

  const ranked = withNames.map((row) => ({
    ...row,
    territoryRank:
      territoryRankByKey.get(`${row.territoryId}:${row.productId}`) ?? 0,
    overallRank:
      overallRankByKey.get(`${row.territoryId}:${row.productId}`) ?? 0,
  }));

  let ordered: TerritoryProductSalesRow[];
  switch (sortMode) {
    case "quantity-asc":
      ordered = ranked.sort((a, b) => {
        const qty = a.soldQuantity.comparedTo(b.soldQuantity);
        if (qty !== 0) return qty;
        return a.productName.localeCompare(b.productName);
      });
      break;
    case "product-asc":
      ordered = ranked.sort((a, b) => {
        const name = a.productName.localeCompare(b.productName);
        if (name !== 0) return name;
        return a.territoryName.localeCompare(b.territoryName);
      });
      break;
    case "territory-asc":
      ordered = ranked.sort((a, b) => {
        const t = a.territoryName.localeCompare(b.territoryName);
        if (t !== 0) return t;
        return compareQuantityDescThenName(a, b);
      });
      break;
    case "quantity-desc":
    default:
      ordered = ranked.sort((a, b) => {
        const t = a.territoryName.localeCompare(b.territoryName);
        if (t !== 0) return t;
        return compareQuantityDescThenName(a, b);
      });
      break;
  }

  if (view === "product-territory" && sortMode === "quantity-desc") {
    return [...ordered].sort((a, b) => {
      const name = a.productName.localeCompare(b.productName);
      if (name !== 0) return name;
      return compareQuantityDescThenName(a, b);
    });
  }

  return ordered;
}

function buildTerritorySubtotals(
  rows: ReadonlyArray<TerritoryProductSalesRow>,
): TerritorySubtotal[] {
  const map = new Map<string, TerritorySubtotal>();
  for (const row of rows) {
    const existing = map.get(row.territoryId);
    if (!existing) {
      map.set(row.territoryId, {
        territoryId: row.territoryId,
        territoryName: row.territoryName,
        soldQuantity: row.soldQuantity,
      });
    } else {
      existing.soldQuantity = existing.soldQuantity.plus(row.soldQuantity);
    }
  }
  return [...map.values()].sort((a, b) =>
    a.territoryName.localeCompare(b.territoryName),
  );
}

export async function getTerritoryProductSalesReport(
  params: ProductSalesFilterParams,
  scope: TerritoryScope,
  client: ProductSalesReadClient = prisma,
): Promise<TerritoryProductSalesReport> {
  assertScopedReportAccess(scope);
  const filters = normalizeFilters(params);
  assertTerritoryInScope(scope, filters.territoryId);

  const bounds = toExclusiveDateBounds(filters.from, filters.to);
  const generatedAt = new Date();

  const queryOptions = {
    fromInclusive: bounds.fromInclusive,
    toExclusive: bounds.toExclusive,
    territoryId: filters.territoryId,
    productId: filters.productId,
    categoryId: filters.categoryId,
    productSearch: filters.productSearch,
  };

  const [aggregate, territories, distinctCounts] = await Promise.all([
    aggregateTerritoryProductSales(client, scope, queryOptions),
    findTerritoryOptionsForScope(client, scope),
    countDistinctInvoicesAndDealers(client, scope, queryOptions),
  ]);

  const territoryNames = buildTerritoryNameMap(territories);
  const ordered = applyRanksAndSort(
    aggregate.rows,
    territoryNames,
    filters.sort,
    filters.view,
  );

  const totalRows = ordered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize) || 1);
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;
  const pageRows = ordered.slice(start, start + filters.pageSize);

  const productIds = new Set(ordered.map((r) => r.productId));
  const territoryIds = new Set(ordered.map((r) => r.territoryId));

  return {
    rows: pageRows,
    summary: {
      totalQuantity: sumSoldQuantity(ordered),
      distinctProducts: productIds.size,
      distinctTerritories: territoryIds.size,
      invoiceCount: distinctCounts.invoiceCount,
      dealerCount: distinctCounts.dealerCount,
    },
    diagnostics: aggregate.diagnostics,
    pagination: {
      page,
      pageSize: filters.pageSize,
      totalRows,
      totalPages,
    },
    territorySubtotals: buildTerritorySubtotals(ordered),
    generatedAt,
  };
}

export async function getTopSellingProductsByTerritory(
  params: ProductSalesFilterParams,
  scope: TerritoryScope,
  client: ProductSalesReadClient = prisma,
): Promise<TopSellingProductsChart> {
  assertScopedReportAccess(scope);
  const filters = normalizeFilters(params);
  assertTerritoryInScope(scope, filters.territoryId);

  const bounds = toExclusiveDateBounds(filters.from, filters.to);
  const generatedAt = new Date();

  const [aggregate, territories] = await Promise.all([
    aggregateTerritoryProductSales(client, scope, {
      fromInclusive: bounds.fromInclusive,
      toExclusive: bounds.toExclusive,
      territoryId: filters.territoryId,
      productId: filters.productId,
      categoryId: filters.categoryId,
      productSearch: filters.productSearch,
    }),
    findTerritoryOptionsForScope(client, scope),
  ]);

  const territoryNames = buildTerritoryNameMap(territories);

  const byProduct = new Map<
    string,
    {
      productId: string;
      productCode: string;
      productName: string;
      soldQuantity: Prisma.Decimal;
      territories: Set<string>;
    }
  >();

  for (const row of aggregate.rows) {
    const existing = byProduct.get(row.productId);
    if (!existing) {
      byProduct.set(row.productId, {
        productId: row.productId,
        productCode: row.productCode,
        productName: row.productName,
        soldQuantity: row.soldQuantity,
        territories: new Set([row.territoryId]),
      });
    } else {
      existing.soldQuantity = existing.soldQuantity.plus(row.soldQuantity);
      existing.territories.add(row.territoryId);
    }
  }

  const points = [...byProduct.values()]
    .map((p) => ({
      productId: p.productId,
      productCode: p.productCode,
      productName: p.productName,
      soldQuantity: p.soldQuantity,
      territoryCount: p.territories.size,
    }))
    .sort(compareQuantityDescThenName)
    .slice(0, filters.limit);

  const topProductIds = new Set(points.map((p) => p.productId));
  const seriesMap = new Map<
    string,
    {
      territoryId: string;
      territoryName: string;
      points: TopSellingProductsChart["points"];
    }
  >();

  for (const row of aggregate.rows) {
    if (!topProductIds.has(row.productId)) {
      continue;
    }
    const series = seriesMap.get(row.territoryId) ?? {
      territoryId: row.territoryId,
      territoryName: territoryNames.get(row.territoryId) ?? row.territoryId,
      points: [],
    };
    series.points.push({
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
      soldQuantity: row.soldQuantity,
      territoryCount: 1,
    });
    seriesMap.set(row.territoryId, series);
  }

  const series = [...seriesMap.values()]
    .map((s) => ({
      ...s,
      points: s.points.sort(compareQuantityDescThenName),
      total: sumSoldQuantity(s.points),
    }))
    .sort((a, b) => b.total.comparedTo(a.total))
    .slice(0, 5)
    .map(({ territoryId, territoryName, points: pts }) => ({
      territoryId,
      territoryName,
      points: pts,
    }));

  const reportHref = `/reports/product-sales-by-territory?${buildProductSalesQuery({
    ...filters,
    page: 1,
  })}`;

  return {
    points,
    series,
    diagnostics: aggregate.diagnostics,
    reportHref,
    generatedAt,
  };
}

export async function getProductSalesFilterOptions(
  scope: TerritoryScope,
  options?: { categoryId?: string | null; productSearch?: string },
  client: ProductSalesReadClient = prisma,
): Promise<{
  territories: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  products: Array<{ id: string; code: string; name: string }>;
}> {
  assertScopedReportAccess(scope);

  const [territories, categories, products] = await Promise.all([
    findTerritoryOptionsForScope(client, scope),
    findCategoryOptions(client),
    findProductOptions(client, {
      categoryId: options?.categoryId,
      search: options?.productSearch,
      take: 200,
    }),
  ]);

  return { territories, categories, products };
}

export async function getAllowedTerritoryOptions(
  scope: TerritoryScope,
  client: ProductSalesReadClient = prisma,
): Promise<Array<{ id: string; name: string }>> {
  return findTerritoryOptionsForScope(client, scope);
}

export { formatLocalDateOnly };
