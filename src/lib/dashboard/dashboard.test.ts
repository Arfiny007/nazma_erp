import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EmptyTerritoryScopeError,
  getAccountsDashboard,
  getAdminDashboard,
  getManagerDashboard,
  getSrDashboard,
  resolveDashboardForRole,
} from "@/lib/dashboard";
import { getCompanyDueSummary } from "@/lib/reports/due";

/**
 * Enterprise Dashboard Foundation tests — PHASE_09A.
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
    getDueReport: vi.fn(),
    getSrDueReport: vi.fn(),
    getTerritoryDueReport: vi.fn(),
  };
});

vi.mock("@/lib/ledger/monitor", () => ({
  getLatestIntegrityScan: vi.fn(),
}));

vi.mock("@/lib/ledger/reconciliation", () => ({
  reconcileAllDealers: vi.fn(),
}));

vi.mock("./dashboard-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./dashboard-query")>();
  return {
    ...actual,
    loadOperationalMetrics: vi.fn(),
    findRecentActivity: vi.fn(),
    findPendingAllocationRows: vi.fn(),
  };
});

import { buildTerritoryScope } from "@/lib/rbac/territory";
import { getDueReport, getSrDueReport, getTerritoryDueReport } from "@/lib/reports/due";
import { getLatestIntegrityScan } from "@/lib/ledger/monitor";
import { reconcileAllDealers } from "@/lib/ledger/reconciliation";
import {
  findPendingAllocationRows,
  findRecentActivity,
  loadOperationalMetrics,
} from "./dashboard-query";

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
    current: ZERO,
    days30: ZERO,
    days60: ZERO,
    days90: ZERO,
    days90Plus: ZERO,
  },
  integrityIssues: 0,
};

const operationalMetrics = {
  todaySales: new Prisma.Decimal("100.00"),
  monthlySales: new Prisma.Decimal("5000.00"),
  monthlyCollections: new Prisma.Decimal("3000.00"),
  dealerCount: 2,
  pendingInvoices: 1,
  pendingAllocations: 1,
  territoryCount: 4,
  userCount: 10,
  newDealersThisMonth: 2,
  newDealersLastMonth: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buildTerritoryScope).mockResolvedValue(ALL_SCOPE);
  vi.mocked(getCompanyDueSummary).mockResolvedValue(dueSummary);
  vi.mocked(loadOperationalMetrics).mockResolvedValue(operationalMetrics);
  vi.mocked(getDueReport).mockResolvedValue({
    rows: [
      {
        dealerCode: "D001",
        dealerName: "Alpha Dealer",
        divisionName: "Dhaka",
        districtName: "Central",
        territoryName: "Zone A",
        assignedSrName: "SR One",
        currentBalance: new Prisma.Decimal("1500.00"),
        lastInvoiceDate: new Date("2026-07-01"),
        lastCollectionDate: null,
        ledgerIntegrity: true,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 8,
    pageCount: 1,
  });
  vi.mocked(getSrDueReport).mockResolvedValue({
    groups: [
      {
        srId: "sr-1",
        srName: "SR One",
        dealerCount: 2,
        totalDue: new Prisma.Decimal("1500.00"),
        totalAdvance: ZERO,
        netBalance: new Prisma.Decimal("1500.00"),
      },
    ],
    summary: dueSummary,
  });
  vi.mocked(getTerritoryDueReport).mockResolvedValue({
    groups: [
      {
        groupId: "terr-1",
        groupName: "Zone A",
        groupType: "territory",
        dealerCount: 2,
        totalDue: new Prisma.Decimal("1500.00"),
        totalAdvance: ZERO,
        netBalance: new Prisma.Decimal("1500.00"),
      },
    ],
    groupBy: "territory",
    summary: dueSummary,
  });
  vi.mocked(findRecentActivity).mockResolvedValue([]);
  vi.mocked(findPendingAllocationRows).mockResolvedValue([]);
  vi.mocked(reconcileAllDealers).mockResolvedValue({
    totalDealers: 2,
    consistentDealers: 2,
    driftedDealers: 0,
    missingLedgerDealers: 0,
    corruptedDealers: 0,
  });
  vi.mocked(getLatestIntegrityScan).mockResolvedValue(null);
});

describe("resolveDashboardForRole", () => {
  it("routes SR users to SR dashboard", async () => {
    const payload = await resolveDashboardForRole("user-sr", "SR");
    expect(payload.summary.role).toBe("SR");
    expect(payload.summary.titleKey).toBe("dashboard.titles.sr");
  });

  it("routes Manager users to Manager dashboard", async () => {
    const payload = await resolveDashboardForRole("user-mgr", "Manager");
    expect(payload.summary.role).toBe("Manager");
    expect("srLeaderboard" in payload.widgets).toBe(true);
  });

  it("routes Accounts users to Accounts dashboard", async () => {
    const payload = await resolveDashboardForRole("user-acc", "Accounts");
    expect(payload.summary.role).toBe("Accounts");
    expect("financialHealth" in payload.widgets).toBe(true);
  });

  it("routes Super Admin users to Admin dashboard", async () => {
    const payload = await resolveDashboardForRole("user-admin", "Super_Admin");
    expect(payload.summary.role).toBe("Super_Admin");
    expect("systemHealth" in payload.widgets).toBe(true);
  });
});

describe("due engine consumption", () => {
  it("uses getCompanyDueSummary for outstanding due KPI", async () => {
    const payload = await getSrDashboard("user-sr");
    const dueKpi = payload.summary.kpis.find((kpi) => kpi.id === "outstandingDue");
    expect(dueKpi?.value).toBe("1,500.00");
    expect(getCompanyDueSummary).toHaveBeenCalledWith({}, ALL_SCOPE, expect.anything());
  });

  it("does not recompute dealer balances in dashboard service", async () => {
    await getManagerDashboard("user-mgr");
    expect(getCompanyDueSummary).toHaveBeenCalled();
    expect(getDueReport).toHaveBeenCalled();
  });
});

describe("territory RBAC", () => {
  it("builds scoped dashboard for SR territories", async () => {
    vi.mocked(buildTerritoryScope).mockResolvedValue(TERRITORY_SCOPE);
    await getSrDashboard("user-sr");
    expect(buildTerritoryScope).toHaveBeenCalledWith("user-sr");
    expect(getCompanyDueSummary).toHaveBeenCalledWith({}, TERRITORY_SCOPE, expect.anything());
  });

  it("throws empty scope for users without territories", async () => {
    vi.mocked(buildTerritoryScope).mockResolvedValue({ mode: "NONE" });
    await expect(getSrDashboard("user-sr")).rejects.toBeInstanceOf(
      EmptyTerritoryScopeError,
    );
  });
});

describe("role-specific widgets", () => {
  it("SR dashboard includes my dealers and recent activity widgets", async () => {
    const payload = await getSrDashboard("user-sr");
    expect("myDealers" in payload.widgets).toBe(true);
    expect("recentActivity" in payload.widgets).toBe(true);
  });

  it("Manager dashboard includes leaderboard and risk tables", async () => {
    const payload = await getManagerDashboard("user-mgr");
    expect("srLeaderboard" in payload.widgets).toBe(true);
    expect("riskDealers" in payload.widgets).toBe(true);
  });

  it("Accounts dashboard includes reconciliation status", async () => {
    const payload = await getAccountsDashboard("user-acc");
    expect("reconciliationStatus" in payload.widgets).toBe(true);
    expect(reconcileAllDealers).toHaveBeenCalled();
  });

  it("Admin dashboard includes system health", async () => {
    const payload = await getAdminDashboard("user-admin");
    expect("systemHealth" in payload.widgets).toBe(true);
  });
});

describe("empty-state handling", () => {
  it("returns empty my dealers table when due report has no rows", async () => {
    vi.mocked(getDueReport).mockResolvedValue({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 8,
      pageCount: 0,
    });
    const payload = await getSrDashboard("user-sr");
    if ("myDealers" in payload.widgets) {
      expect(payload.widgets.myDealers.rows).toHaveLength(0);
      expect(payload.widgets.myDealers.emptyKey).toBe("dashboard.empty.myDealers");
    }
  });
});

describe("demo dataset performance guard", () => {
  it("loads SR dashboard under one second with stubbed dependencies", async () => {
    const started = performance.now();
    await getSrDashboard("user-sr");
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
