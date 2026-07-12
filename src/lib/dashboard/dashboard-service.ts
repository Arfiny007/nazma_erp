import type { UserRole } from "@prisma/client";

import { getLatestIntegrityScan } from "@/lib/ledger/monitor";
import { reconcileAllDealers } from "@/lib/ledger/reconciliation";
import { prisma } from "@/lib/prisma";
import {
  getCompanyDueSummary,
  getDueReport,
  getSrDueReport,
  getTerritoryDueReport,
} from "@/lib/reports/due";
import { buildTerritoryScope } from "@/lib/rbac/territory";

import {
  findPendingAllocationRows,
  findRecentActivity,
  loadOperationalMetrics,
  type DashboardReadClient,
} from "./dashboard-query";
import {
  buildDashboardPayload,
  buildDashboardSummary,
  buildKpi,
  formatCount,
  formatMoney,
  mapDueReportRowsToTable,
  mapDueRowsToTable,
  mapFinancialHealthWidget,
  mapIntegrityStatusWidget,
  mapDueSummaryToKpis,
  mapPendingAllocationRows,
  mapRecentActivity,
  mapSrGroupsToRows,
  mapSystemHealthWidget,
  mapTerritoryGroupsToRows,
} from "./dashboard-mappers";
import type { DashboardPayload } from "./dashboard-types";
import {
  assertDashboardRole,
  assertScopedDashboardAccess,
  buildDashboardContext,
} from "./dashboard-validation";

const TABLE_LIMIT = 8;
const ACTIVITY_LIMIT = 10;

async function loadSharedDueSummary(
  userId: string,
  client: DashboardReadClient = prisma,
) {
  const scope = await buildTerritoryScope(userId);
  assertScopedDashboardAccess(scope);
  const dueSummary = await getCompanyDueSummary({}, scope, client);
  return { scope, dueSummary };
}

/**
 * SR dashboard — scoped to assigned territories; my dealers filtered by SR assignment.
 */
export async function getSrDashboard(
  userId: string,
  client: DashboardReadClient = prisma,
): Promise<DashboardPayload> {
  const context = buildDashboardContext(userId, "SR");
  const generatedAt = new Date();
  const { scope, dueSummary } = await loadSharedDueSummary(userId, client);
  const metrics = await loadOperationalMetrics(scope, generatedAt, client);

  const [myDealersReport, recentRecords] = await Promise.all([
    getDueReport(
      {
        assignedSrId: userId,
        includeZeroBalance: false,
        includeAdvance: true,
        page: 1,
        pageSize: TABLE_LIMIT,
      },
      scope,
      client,
    ),
    findRecentActivity(scope, ACTIVITY_LIMIT, client),
  ]);

  const kpis = mapDueSummaryToKpis(dueSummary, {
    includeDealerCount: true,
    includeCollections: formatMoney(metrics.monthlyCollections),
    includeSales: {
      today: formatMoney(metrics.todaySales),
      monthly: formatMoney(metrics.monthlySales),
    },
    extra: [
      buildKpi(
        "pendingInvoices",
        "dashboard.kpi.pendingInvoices",
        formatCount(metrics.pendingInvoices),
        { href: "/invoices" },
      ),
    ],
  });

  const summary = buildDashboardSummary(context.role, kpis);

  return buildDashboardPayload(
    summary,
    {
      myDealers: mapDueRowsToTable(
        "myDealers",
        "dashboard.widgets.myDealers",
        [
          { key: "dealer", labelKey: "dashboard.columns.dealer" },
          { key: "territory", labelKey: "dashboard.columns.territory" },
          { key: "due", labelKey: "dashboard.columns.due", align: "right" },
        ],
        mapDueReportRowsToTable(myDealersReport.rows),
        "dashboard.empty.myDealers",
      ),
      recentActivity: mapRecentActivity(recentRecords),
    },
    generatedAt,
  );
}

/**
 * Manager dashboard — territory oversight with SR leaderboard and risk dealers.
 */
export async function getManagerDashboard(
  userId: string,
  client: DashboardReadClient = prisma,
): Promise<DashboardPayload> {
  const context = buildDashboardContext(userId, "Manager");
  const generatedAt = new Date();
  const { scope, dueSummary } = await loadSharedDueSummary(userId, client);
  const metrics = await loadOperationalMetrics(scope, generatedAt, client);

  const [srReport, territoryReport, riskReport] = await Promise.all([
    getSrDueReport({}, scope, client),
    getTerritoryDueReport({ groupBy: "territory" }, scope, client),
    getDueReport(
      {
        includeZeroBalance: false,
        includeAdvance: false,
        page: 1,
        pageSize: TABLE_LIMIT,
      },
      scope,
      client,
    ),
  ]);

  const sortedRiskRows = [...riskReport.rows].sort((a, b) =>
    b.currentBalance.minus(a.currentBalance).toNumber(),
  );

  const kpis: ReturnType<typeof buildKpi>[] = [
    buildKpi(
      "totalDealers",
      "dashboard.kpi.totalDealers",
      formatCount(dueSummary.totalDealers),
      { href: "/dealers" },
    ),
    buildKpi(
      "territorySales",
      "dashboard.kpi.territorySales",
      formatMoney(metrics.monthlySales),
      { href: "/invoices" },
    ),
    buildKpi(
      "territoryCollections",
      "dashboard.kpi.territoryCollections",
      formatMoney(metrics.monthlyCollections),
      { href: "/collections" },
    ),
    buildKpi(
      "outstandingDue",
      "dashboard.kpi.outstandingDue",
      formatMoney(dueSummary.totalDue),
      { href: "/reports/due", tone: dueSummary.totalDue.gt(0) ? "warning" : "default" },
    ),
  ];

  const summary = buildDashboardSummary(context.role, kpis);

  return buildDashboardPayload(
    summary,
    {
      srLeaderboard: mapDueRowsToTable(
        "srLeaderboard",
        "dashboard.widgets.srLeaderboard",
        [
          { key: "sr", labelKey: "dashboard.columns.sr" },
          { key: "dealers", labelKey: "dashboard.columns.dealers", align: "right" },
          { key: "totalDue", labelKey: "dashboard.columns.totalDue", align: "right" },
          { key: "netBalance", labelKey: "dashboard.columns.netBalance", align: "right" },
        ],
        mapSrGroupsToRows(srReport.groups.slice(0, TABLE_LIMIT)),
        "dashboard.empty.srLeaderboard",
      ),
      riskDealers: mapDueRowsToTable(
        "riskDealers",
        "dashboard.widgets.riskDealers",
        [
          { key: "dealer", labelKey: "dashboard.columns.dealer" },
          { key: "territory", labelKey: "dashboard.columns.territory" },
          { key: "due", labelKey: "dashboard.columns.due", align: "right" },
        ],
        mapDueReportRowsToTable(sortedRiskRows),
        "dashboard.empty.riskDealers",
      ),
      territoryComparison: mapDueRowsToTable(
        "territoryComparison",
        "dashboard.widgets.territoryComparison",
        [
          { key: "territory", labelKey: "dashboard.columns.territory" },
          { key: "dealers", labelKey: "dashboard.columns.dealers", align: "right" },
          { key: "totalDue", labelKey: "dashboard.columns.totalDue", align: "right" },
          { key: "netBalance", labelKey: "dashboard.columns.netBalance", align: "right" },
        ],
        mapTerritoryGroupsToRows(territoryReport.groups.slice(0, TABLE_LIMIT)),
        "dashboard.empty.territoryComparison",
      ),
    },
    generatedAt,
  );
}

/**
 * Accounts dashboard — company-wide financial overview.
 */
export async function getAccountsDashboard(
  userId: string,
  client: DashboardReadClient = prisma,
): Promise<DashboardPayload> {
  const context = buildDashboardContext(userId, "Accounts");
  const generatedAt = new Date();
  const { scope, dueSummary } = await loadSharedDueSummary(userId, client);
  const metrics = await loadOperationalMetrics(scope, generatedAt, client);

  const [reconciliation, latestScan, pendingRows] = await Promise.all([
    reconcileAllDealers(),
    getLatestIntegrityScan(),
    findPendingAllocationRows(scope, TABLE_LIMIT, client),
  ]);

  const kpis = [
    buildKpi(
      "companyReceivables",
      "dashboard.kpi.companyReceivables",
      formatMoney(dueSummary.netReceivable),
      { href: "/reports/due" },
    ),
    buildKpi(
      "totalCollections",
      "dashboard.kpi.totalCollections",
      formatMoney(metrics.monthlyCollections),
      { href: "/collections" },
    ),
    buildKpi(
      "totalDue",
      "dashboard.kpi.totalDue",
      formatMoney(dueSummary.totalDue),
      { href: "/reports/due" },
    ),
    buildKpi(
      "pendingAllocations",
      "dashboard.kpi.pendingAllocations",
      formatCount(metrics.pendingAllocations),
      { href: "/collections", tone: metrics.pendingAllocations > 0 ? "warning" : "default" },
    ),
  ];

  const summary = buildDashboardSummary(context.role, kpis);

  return buildDashboardPayload(
    summary,
    {
      financialHealth: mapFinancialHealthWidget(dueSummary),
      reconciliationStatus: mapIntegrityStatusWidget(latestScan, reconciliation),
      pendingAllocations: mapDueRowsToTable(
        "pendingAllocations",
        "dashboard.widgets.pendingAllocations",
        [
          { key: "collection", labelKey: "dashboard.columns.collection" },
          { key: "dealer", labelKey: "dashboard.columns.dealer" },
          { key: "amount", labelKey: "dashboard.columns.amount", align: "right" },
          { key: "date", labelKey: "dashboard.columns.date", align: "right" },
        ],
        mapPendingAllocationRows(pendingRows),
        "dashboard.empty.pendingAllocations",
      ),
    },
    generatedAt,
  );
}

/**
 * Super Admin dashboard — company-wide operational and integrity overview.
 */
export async function getAdminDashboard(
  userId: string,
  client: DashboardReadClient = prisma,
): Promise<DashboardPayload> {
  const context = buildDashboardContext(userId, "Super_Admin");
  const generatedAt = new Date();
  const { scope, dueSummary } = await loadSharedDueSummary(userId, client);
  const metrics = await loadOperationalMetrics(scope, generatedAt, client);

  const [reconciliation, latestScan] = await Promise.all([
    reconcileAllDealers(),
    getLatestIntegrityScan(),
  ]);

  const growthDelta = metrics.newDealersThisMonth - metrics.newDealersLastMonth;
  const growthLabel =
    growthDelta >= 0 ? `+${formatCount(growthDelta)}` : formatCount(growthDelta);

  const kpis = [
    buildKpi(
      "companyRevenue",
      "dashboard.kpi.companyRevenue",
      formatMoney(metrics.monthlySales),
      { href: "/invoices" },
    ),
    buildKpi(
      "companyCollections",
      "dashboard.kpi.companyCollections",
      formatMoney(metrics.monthlyCollections),
      { href: "/collections" },
    ),
    buildKpi(
      "companyDue",
      "dashboard.kpi.companyDue",
      formatMoney(dueSummary.totalDue),
      { href: "/reports/due" },
    ),
    buildKpi(
      "territoryCount",
      "dashboard.kpi.territoryCount",
      formatCount(metrics.territoryCount),
      { href: "/settings/territories" },
    ),
    buildKpi(
      "userCount",
      "dashboard.kpi.userCount",
      formatCount(metrics.userCount),
      { href: "/users" },
    ),
  ];

  const summary = buildDashboardSummary(context.role, kpis);

  return buildDashboardPayload(
    summary,
    {
      systemHealth: mapSystemHealthWidget(latestScan),
      financialIntegrity: mapIntegrityStatusWidget(latestScan, reconciliation),
      dealerGrowth: [
        buildKpi(
          "newThisMonth",
          "dashboard.kpi.newDealersThisMonth",
          formatCount(metrics.newDealersThisMonth),
          { href: "/dealers" },
        ),
        buildKpi(
          "newLastMonth",
          "dashboard.kpi.newDealersLastMonth",
          formatCount(metrics.newDealersLastMonth),
        ),
        buildKpi(
          "growthDelta",
          "dashboard.kpi.dealerGrowthDelta",
          growthLabel,
          { tone: growthDelta >= 0 ? "success" : "warning" },
        ),
      ],
    },
    generatedAt,
  );
}

/** Resolves role-aware dashboard payload for the authenticated user. */
export async function resolveDashboardForRole(
  userId: string,
  role: UserRole,
  client: DashboardReadClient = prisma,
): Promise<DashboardPayload> {
  const dashboardRole = assertDashboardRole(role);

  switch (dashboardRole) {
    case "SR":
      return getSrDashboard(userId, client);
    case "Manager":
      return getManagerDashboard(userId, client);
    case "Accounts":
      return getAccountsDashboard(userId, client);
    case "Super_Admin":
      return getAdminDashboard(userId, client);
    default:
      return getAdminDashboard(userId, client);
  }
}
