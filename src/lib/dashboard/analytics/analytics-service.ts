import type { UserRole } from "@prisma/client";

import { startOfDay, startOfMonth } from "@/lib/dashboard/dashboard-validation";
import { getLatestIntegrityScan } from "@/lib/ledger/monitor";
import { prisma } from "@/lib/prisma";
import { getCompanyDueSummary } from "@/lib/reports/due";
import {
  DEFAULT_TOP_PRODUCTS_LIMIT,
  getTopSellingProductsByTerritory,
} from "@/lib/reports/product-sales-territory";
import { buildTerritoryScope } from "@/lib/rbac/territory";

import {
  aggregateTerritoryDue,
  aggregateTerritorySalesCollections,
  buildMonthlyCollectionEfficiency,
  buildMonthlyCollectionTrend,
  buildMonthlyDealerGrowthTrend,
  buildMonthlyOutstandingTrend,
  buildMonthlySalesTrend,
  buildMonthlyTerritoryGrowth,
  buildMonthlyUserGrowth,
  buildRiskDealerAgingBuckets,
  buildSrLeaderboardMetrics,
  type AnalyticsReadClient,
} from "./analytics-query";
import {
  mapAgingBucketChart,
  mapCountTrendToChart,
  mapDecimalTrendToChart,
  mapIntegrityOverviewChart,
  mapRatioTrendToChart,
  mapReceivableTrendChart,
  mapRiskDealerChart,
  mapSrLeaderboardChart,
  mapTerritoryComparisonChart,
  mapTerritoryHeatmap,
  mapTopProductsByQuantityChart,
} from "./analytics-mappers";
import type {
  AccountsAnalyticsPayload,
  AdminAnalyticsPayload,
  AnalyticsPayload,
  ManagerAnalyticsPayload,
  SrAnalyticsPayload,
} from "./analytics-types";
import {
  assertAnalyticsRole,
  assertAnalyticsScope,
  buildAnalyticsContext,
} from "./analytics-validation";

async function loadAnalyticsScope(userId: string) {
  const scope = await buildTerritoryScope(userId);
  assertAnalyticsScope(scope);
  return scope;
}

async function loadTopProductsChart(
  scope: Awaited<ReturnType<typeof loadAnalyticsScope>>,
  generatedAt: Date,
) {
  try {
    const chart = await getTopSellingProductsByTerritory(
      {
        from: startOfMonth(generatedAt),
        to: startOfDay(generatedAt),
        limit: DEFAULT_TOP_PRODUCTS_LIMIT,
      },
      scope,
    );
    return mapTopProductsByQuantityChart(chart.points, {
      href: chart.reportHref,
    });
  } catch {
    return mapTopProductsByQuantityChart([], undefined);
  }
}

/**
 * SR analytics — territory-scoped BI charts.
 */
export async function getSrAnalytics(
  userId: string,
  client: AnalyticsReadClient = prisma,
): Promise<SrAnalyticsPayload> {
  buildAnalyticsContext(userId, "SR");
  const generatedAt = new Date();
  const scope = await loadAnalyticsScope(userId);

  const [salesTrend, collectionTrend, outstandingTrend, dealerGrowth, topProducts] =
    await Promise.all([
      buildMonthlySalesTrend(scope, undefined, generatedAt, client),
      buildMonthlyCollectionTrend(scope, undefined, generatedAt, client),
      buildMonthlyOutstandingTrend(scope, undefined, generatedAt, client),
      buildMonthlyDealerGrowthTrend(scope, undefined, generatedAt, client),
      loadTopProductsChart(scope, generatedAt),
    ]);

  return {
    role: "SR",
    charts: [
      mapDecimalTrendToChart(
        "monthlySales",
        "dashboard.analytics.charts.monthlySales",
        "line",
        salesTrend,
      ),
      mapDecimalTrendToChart(
        "collectionTrend",
        "dashboard.analytics.charts.collectionTrend",
        "area",
        collectionTrend,
      ),
      mapDecimalTrendToChart(
        "outstandingTrend",
        "dashboard.analytics.charts.outstandingTrend",
        "line",
        outstandingTrend,
      ),
      mapCountTrendToChart(
        "dealerGrowth",
        "dashboard.analytics.charts.dealerGrowth",
        "bar",
        dealerGrowth,
      ),
      topProducts,
    ],
    generatedAt: generatedAt.toISOString(),
  };
}

/**
 * Manager analytics — territory comparison and SR leaderboard charts.
 */
export async function getManagerAnalytics(
  userId: string,
  client: AnalyticsReadClient = prisma,
): Promise<ManagerAnalyticsPayload> {
  buildAnalyticsContext(userId, "Manager");
  const generatedAt = new Date();
  const scope = await loadAnalyticsScope(userId);
  const monthStart = startOfMonth(generatedAt);

  const [territorySales, territoryDueMap, srMetrics, riskDealers, dueSummary, topProducts] =
    await Promise.all([
      aggregateTerritorySalesCollections(scope, monthStart, generatedAt, client),
      aggregateTerritoryDue(scope, client),
      buildSrLeaderboardMetrics(scope, monthStart, generatedAt, 8, client),
      buildRiskDealerAgingBuckets(scope, 8, generatedAt, client),
      getCompanyDueSummary({}, scope, client),
      loadTopProductsChart(scope, generatedAt),
    ]);

  const territoryDueRows = territorySales.map((row) => ({
    territoryName: row.territoryName,
    value: territoryDueMap.get(row.territoryId)?.due ?? row.sales.mul(0),
  }));

  return {
    role: "Manager",
    charts: [
      mapTerritoryComparisonChart(
        "territorySales",
        "dashboard.analytics.charts.territorySales",
        territorySales.map((row) => ({
          territoryName: row.territoryName,
          value: row.sales,
        })),
      ),
      mapTerritoryComparisonChart(
        "territoryCollections",
        "dashboard.analytics.charts.territoryCollections",
        territorySales.map((row) => ({
          territoryName: row.territoryName,
          value: row.collections,
        })),
      ),
      mapTerritoryComparisonChart(
        "territoryDue",
        "dashboard.analytics.charts.territoryDue",
        territoryDueRows,
      ),
      topProducts,
      mapSrLeaderboardChart(
        "srSalesLeaderboard",
        "dashboard.analytics.charts.srSales",
        srMetrics.map((row) => ({ srName: row.srName, value: row.sales })),
      ),
      mapSrLeaderboardChart(
        "srCollectionsLeaderboard",
        "dashboard.analytics.charts.srCollections",
        srMetrics.map((row) => ({
          srName: row.srName,
          value: row.collections,
        })),
      ),
      mapSrLeaderboardChart(
        "srDueLeaderboard",
        "dashboard.analytics.charts.srOutstanding",
        srMetrics.map((row) => ({
          srName: row.srName,
          value: row.outstandingDue,
        })),
      ),
      mapRiskDealerChart(riskDealers),
      mapAgingBucketChart(dueSummary.aging),
    ],
    generatedAt: generatedAt.toISOString(),
  };
}

/**
 * Accounts analytics — receivable trend, collection efficiency, integrity overview.
 */
export async function getAccountsAnalytics(
  userId: string,
  client: AnalyticsReadClient = prisma,
): Promise<AccountsAnalyticsPayload> {
  buildAnalyticsContext(userId, "Accounts");
  const generatedAt = new Date();
  const scope = await loadAnalyticsScope(userId);

  const [dueSummary, salesTrend, efficiencyTrend, latestScan] =
    await Promise.all([
      getCompanyDueSummary({}, scope, client),
      buildMonthlySalesTrend(scope, undefined, generatedAt, client),
      buildMonthlyCollectionEfficiency(scope, undefined, generatedAt, client),
      getLatestIntegrityScan(),
    ]);

  return {
    role: "Accounts",
    charts: [
      mapReceivableTrendChart(salesTrend, dueSummary.netReceivable),
      mapRatioTrendToChart(
        "collectionEfficiency",
        "dashboard.analytics.charts.collectionEfficiency",
        efficiencyTrend,
      ),
      mapIntegrityOverviewChart(latestScan),
      mapAgingBucketChart(dueSummary.aging),
    ],
    generatedAt: generatedAt.toISOString(),
  };
}

/**
 * Super Admin analytics — company-wide trends and territory heatmap DTO.
 */
export async function getAdminAnalytics(
  userId: string,
  client: AnalyticsReadClient = prisma,
): Promise<AdminAnalyticsPayload> {
  buildAnalyticsContext(userId, "Super_Admin");
  const generatedAt = new Date();
  const scope = await loadAnalyticsScope(userId);
  const monthStart = startOfMonth(generatedAt);

  const [
    revenueTrend,
    dealerGrowth,
    territoryGrowth,
    userGrowth,
    territorySales,
    territoryDueMap,
    topProducts,
  ] = await Promise.all([
    buildMonthlySalesTrend(scope, undefined, generatedAt, client),
    buildMonthlyDealerGrowthTrend(scope, undefined, generatedAt, client),
    buildMonthlyTerritoryGrowth(undefined, generatedAt, client),
    buildMonthlyUserGrowth(undefined, generatedAt, client),
    aggregateTerritorySalesCollections(scope, monthStart, generatedAt, client),
    aggregateTerritoryDue(scope, client),
    loadTopProductsChart(scope, generatedAt),
  ]);

  return {
    role: "Super_Admin",
    charts: [
      mapDecimalTrendToChart(
        "revenueTrend",
        "dashboard.analytics.charts.revenueTrend",
        "area",
        revenueTrend,
      ),
      mapCountTrendToChart(
        "dealerGrowth",
        "dashboard.analytics.charts.companyDealerGrowth",
        "line",
        dealerGrowth,
      ),
      mapCountTrendToChart(
        "territoryGrowth",
        "dashboard.analytics.charts.territoryGrowth",
        "bar",
        territoryGrowth,
      ),
      mapCountTrendToChart(
        "userGrowth",
        "dashboard.analytics.charts.userGrowth",
        "line",
        userGrowth,
      ),
      topProducts,
    ],
    territoryHeatmap: mapTerritoryHeatmap(territorySales, territoryDueMap),
    generatedAt: generatedAt.toISOString(),
  };
}

/** Resolves role-aware analytics payload. */
export async function resolveAnalyticsForRole(
  userId: string,
  role: UserRole,
  client: AnalyticsReadClient = prisma,
): Promise<AnalyticsPayload> {
  const analyticsRole = assertAnalyticsRole(role);

  switch (analyticsRole) {
    case "SR":
      return getSrAnalytics(userId, client);
    case "Manager":
      return getManagerAnalytics(userId, client);
    case "Accounts":
      return getAccountsAnalytics(userId, client);
    case "Super_Admin":
      return getAdminAnalytics(userId, client);
    default:
      return getAdminAnalytics(userId, client);
  }
}
