import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EmptyAnalyticsScopeError,
  getAccountsAnalytics,
  getAdminAnalytics,
  getManagerAnalytics,
  getSrAnalytics,
  isValidDashboardChart,
  resolveAnalyticsForRole,
} from "@/lib/dashboard/analytics";
import { getCompanyDueSummary } from "@/lib/reports/due";

/**
 * Enterprise Dashboard Analytics tests — PHASE_09B.
 */

vi.mock("@/lib/rbac/territory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rbac/territory")>();
  return {
    ...actual,
    buildTerritoryScope: vi.fn(),
  };
});

vi.mock("@/lib/reports/due", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/reports/due")>();
  return {
    ...actual,
    getCompanyDueSummary: vi.fn(),
  };
});

vi.mock("@/lib/ledger/monitor", () => ({
  getLatestIntegrityScan: vi.fn(),
}));

vi.mock("./analytics-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./analytics-query")>();
  return {
    ...actual,
    buildMonthlySalesTrend: vi.fn(),
    buildMonthlyCollectionTrend: vi.fn(),
    buildMonthlyOutstandingTrend: vi.fn(),
    buildMonthlyDealerGrowthTrend: vi.fn(),
    aggregateTerritorySalesCollections: vi.fn(),
    aggregateTerritoryDue: vi.fn(),
    buildSrLeaderboardMetrics: vi.fn(),
    buildRiskDealerAgingBuckets: vi.fn(),
    buildMonthlyCollectionEfficiency: vi.fn(),
    buildMonthlyTerritoryGrowth: vi.fn(),
    buildMonthlyUserGrowth: vi.fn(),
  };
});

import { buildTerritoryScope } from "@/lib/rbac/territory";
import { getLatestIntegrityScan } from "@/lib/ledger/monitor";
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
} from "./analytics-query";

const ZERO = new Prisma.Decimal(0);
const ALL_SCOPE = { mode: "ALL" as const };
const TERRITORY_SCOPE = {
  mode: "TERRITORIES" as const,
  territoryIds: ["terr-1"],
};

const dueSummary = {
  totalDealers: 2,
  dealersWithDue: 1,
  dealersWithAdvance: 0,
  totalDue: new Prisma.Decimal("1500.00"),
  totalAdvance: ZERO,
  netReceivable: new Prisma.Decimal("1500.00"),
  aging: {
    current: new Prisma.Decimal("500.00"),
    days30: new Prisma.Decimal("300.00"),
    days60: ZERO,
    days90: ZERO,
    days90Plus: ZERO,
  },
  integrityIssues: 0,
};

const monthTrend = [
  { label: "Jan 26", amount: new Prisma.Decimal("1000.00") },
  { label: "Feb 26", amount: new Prisma.Decimal("1200.00") },
];

const countTrend = [
  { label: "Jan 26", count: 2 },
  { label: "Feb 26", count: 3 },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buildTerritoryScope).mockResolvedValue(TERRITORY_SCOPE);
  vi.mocked(getCompanyDueSummary).mockResolvedValue(dueSummary);
  vi.mocked(getLatestIntegrityScan).mockResolvedValue(null);
  vi.mocked(buildMonthlySalesTrend).mockResolvedValue(monthTrend);
  vi.mocked(buildMonthlyCollectionTrend).mockResolvedValue(monthTrend);
  vi.mocked(buildMonthlyOutstandingTrend).mockResolvedValue(monthTrend);
  vi.mocked(buildMonthlyDealerGrowthTrend).mockResolvedValue(countTrend);
  vi.mocked(aggregateTerritorySalesCollections).mockResolvedValue([
    {
      territoryId: "terr-1",
      territoryName: "Dhaka Central",
      sales: new Prisma.Decimal("5000.00"),
      collections: new Prisma.Decimal("3000.00"),
    },
  ]);
  vi.mocked(aggregateTerritoryDue).mockResolvedValue(
    new Map([
      [
        "terr-1",
        { name: "Dhaka Central", due: new Prisma.Decimal("1500.00") },
      ],
    ]),
  );
  vi.mocked(buildSrLeaderboardMetrics).mockResolvedValue([
    {
      srId: "sr-1",
      srName: "SR One",
      sales: new Prisma.Decimal("4000.00"),
      collections: new Prisma.Decimal("2500.00"),
      outstandingDue: new Prisma.Decimal("1000.00"),
    },
  ]);
  vi.mocked(buildRiskDealerAgingBuckets).mockResolvedValue([
    {
      dealerCode: "D001",
      dealerName: "Risk Dealer",
      currentBalance: new Prisma.Decimal("900.00"),
      aging: dueSummary.aging,
    },
  ]);
  vi.mocked(buildMonthlyCollectionEfficiency).mockResolvedValue([
    { label: "Jan 26", ratio: 75 },
    { label: "Feb 26", ratio: 80 },
  ]);
  vi.mocked(buildMonthlyTerritoryGrowth).mockResolvedValue(countTrend);
  vi.mocked(buildMonthlyUserGrowth).mockResolvedValue(countTrend);
});

describe("analytics chart DTO validity", () => {
  it("validates chart point shape", async () => {
    const payload = await getSrAnalytics("user-sr");
    for (const chart of payload.charts) {
      expect(isValidDashboardChart(chart)).toBe(true);
    }
  });

  it("rejects invalid chart points", () => {
    expect(
      isValidDashboardChart({
        id: "bad",
        titleKey: "dashboard.analytics.charts.monthlySales",
        type: "line",
        data: [{ label: "", value: -1 }],
      }),
    ).toBe(false);
  });
});

describe("SR analytics isolation", () => {
  it("returns SR charts scoped via territory scope", async () => {
    const payload = await getSrAnalytics("user-sr");
    expect(payload.role).toBe("SR");
    expect(payload.charts).toHaveLength(4);
    expect(buildMonthlySalesTrend).toHaveBeenCalledWith(
      TERRITORY_SCOPE,
      undefined,
      expect.any(Date),
      expect.anything(),
    );
  });

  it("throws on empty territory scope", async () => {
    vi.mocked(buildTerritoryScope).mockResolvedValue({
      mode: "NONE",
    });
    await expect(getSrAnalytics("user-sr")).rejects.toBeInstanceOf(
      EmptyAnalyticsScopeError,
    );
  });
});

describe("manager territory analytics", () => {
  it("returns territory comparison and SR leaderboard charts", async () => {
    const payload = await getManagerAnalytics("user-mgr");
    expect(payload.role).toBe("Manager");
    expect(payload.charts.length).toBeGreaterThanOrEqual(7);
    expect(getCompanyDueSummary).toHaveBeenCalledWith(
      {},
      TERRITORY_SCOPE,
      expect.anything(),
    );
  });
});

describe("accounts analytics", () => {
  it("consumes due summary and integrity scan without balance math", async () => {
    vi.mocked(getLatestIntegrityScan).mockResolvedValue({
      scanId: "scan-1",
      totalDealers: 10,
      consistentDealers: 9,
      driftedDealers: 1,
      missingLedgerDealers: 0,
      corruptedDealers: 0,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 120,
      status: "Completed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const payload = await getAccountsAnalytics("user-acct");
    expect(payload.role).toBe("Accounts");
    expect(payload.charts).toHaveLength(4);
    expect(buildMonthlyCollectionEfficiency).toHaveBeenCalled();
  });
});

describe("admin analytics", () => {
  it("returns revenue trend and territory heatmap DTO", async () => {
    vi.mocked(buildTerritoryScope).mockResolvedValue(ALL_SCOPE);
    const payload = await getAdminAnalytics("user-admin");
    expect(payload.role).toBe("Super_Admin");
    expect(payload.territoryHeatmap).toEqual([
      {
        territoryId: "terr-1",
        territoryName: "Dhaka Central",
        sales: 5000,
        collections: 3000,
        due: 1500,
      },
    ]);
  });
});

describe("resolveAnalyticsForRole", () => {
  it("routes by role", async () => {
    const sr = await resolveAnalyticsForRole("user-sr", "SR");
    expect(sr.role).toBe("SR");
  });
});

describe("no duplicate balance calculations", () => {
  it("does not import posting-service in analytics module", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const analyticsDir = path.join(process.cwd(), "src/lib/dashboard/analytics");
    const files = await fs.readdir(analyticsDir);
    for (const file of files) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
      const content = await fs.readFile(
        path.join(analyticsDir, file),
        "utf8",
      );
      expect(content).not.toContain("posting-service");
      expect(content).not.toContain("postReceivable");
      expect(content).not.toContain("Dealer.currentBalance =");
    }
  });
});

describe("empty state handling", () => {
  it("returns charts with empty data arrays when trends are empty", async () => {
    vi.mocked(buildMonthlySalesTrend).mockResolvedValue([]);
    const payload = await getSrAnalytics("user-sr");
    const salesChart = payload.charts.find((c) => c.id === "monthlySales");
    expect(salesChart?.data).toEqual([]);
  });
});

describe("dashboard performance structure", () => {
  it("batches monthly trend queries in parallel per chart family", async () => {
    await getSrAnalytics("user-sr");
    expect(buildMonthlySalesTrend).toHaveBeenCalledTimes(1);
    expect(buildMonthlyCollectionTrend).toHaveBeenCalledTimes(1);
    expect(buildMonthlyOutstandingTrend).toHaveBeenCalledTimes(1);
    expect(buildMonthlyDealerGrowthTrend).toHaveBeenCalledTimes(1);
  });
});

describe("territory leakage guard", () => {
  it("manager analytics uses scoped territory scope from buildTerritoryScope", async () => {
    await getManagerAnalytics("user-mgr");
    expect(buildTerritoryScope).toHaveBeenCalledWith("user-mgr");
    expect(aggregateTerritorySalesCollections).toHaveBeenCalledWith(
      TERRITORY_SCOPE,
      expect.any(Date),
      expect.any(Date),
      expect.anything(),
    );
  });
});
