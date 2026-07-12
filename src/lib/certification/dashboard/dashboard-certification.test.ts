import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  aggregateSubsystemStatuses,
  buildDashboardCertificationExecutiveSummary,
  buildDashboardCertificationResult,
  computeOverallScore,
  countDashboardQuerySurface,
  DASHBOARD_CERTIFICATION_CHECK_CATALOG,
  normalizeMoneyDisplay,
  runAllDashboardCertificationChecks,
  scanDashboardArchitectureImports,
  scanDashboardClientSideMoneyMath,
  scanDashboardFinancialBoundary,
  scanDashboardTerritoryLeakage,
  verifyDashboardKpiParity,
  verifyDashboardSrIsolationBehavior,
} from "@/lib/certification/dashboard";
import { formatMoney } from "@/lib/dashboard";
import type { DashboardPayload } from "@/lib/dashboard";
import {
  getDueReport,
  type DueReportReadClient,
} from "@/lib/reports/due";
import {
  buildScopedTerritoryScope,
  resolveTerritoryScopeMode,
  territoryIdMatchesScope,
} from "@/lib/rbac/territory";

/**
 * Enterprise Dashboard Certification tests — PHASE_09A.5.
 */

interface StubDealer {
  id: string;
  dealerCode: string;
  companyName: string;
  currentBalance: Prisma.Decimal;
  lastInvoiceDate: Date | null;
  lastCollectionDate: Date | null;
  divisionId: string | null;
  districtId: string | null;
  territoryId: string | null;
  division?: { name: string } | null;
  geoDistrict?: { name: string } | null;
  geoTerritory?: { name: string } | null;
  ownershipHistory: Array<{
    assignedSr: { id: string; name: string } | null;
  }>;
}

function makeDashboardCertStub(dealers: StubDealer[]): DueReportReadClient {
  return {
    dealer: {
      findMany: async ({
        where,
        skip,
        take,
      }: {
        where?: { AND?: Array<Record<string, unknown>> };
        skip?: number;
        take?: number;
      }) => {
        let rows = [...dealers];

        if (where?.AND) {
          for (const clause of where.AND) {
            if (clause.AND) {
              for (const nested of clause.AND as Array<Record<string, unknown>>) {
                rows = applyFilter(rows, nested);
              }
            } else {
              rows = applyFilter(rows, clause);
            }
          }
        }

        function applyFilter(
          source: StubDealer[],
          filter: Record<string, unknown>,
        ): StubDealer[] {
          if (filter.territoryId && typeof filter.territoryId === "object") {
            const territoryFilter = filter.territoryId as { in?: string[] };
            if (territoryFilter.in) {
              const allowed = new Set(territoryFilter.in);
              return source.filter(
                (d) => d.territoryId && allowed.has(d.territoryId),
              );
            }
          }
          return source;
        }

        rows.sort((a, b) => b.currentBalance.minus(a.currentBalance).toNumber());
        const start = skip ?? 0;
        const end = take !== undefined ? start + take : undefined;
        return rows.slice(start, end);
      },
      count: async (args: { where?: { AND?: Array<Record<string, unknown>> } }) => {
        const rows = await makeDashboardCertStub(dealers).dealer.findMany(args);
        return rows.length;
      },
      findUnique: async ({ where }: { where: { dealerCode: string } }) =>
        dealers.find((d) => d.dealerCode === where.dealerCode) ?? null,
    },
    invoice: { findMany: async () => [] },
    ledgerEntry: { findMany: async () => [] },
    dealerOwnershipHistory: { findMany: async () => [] },
  } as unknown as DueReportReadClient;
}

const mixedTerritoryDealers: StubDealer[] = [
  {
    id: "d1",
    dealerCode: "T1-001",
    companyName: "Territory One Dealer",
    currentBalance: new Prisma.Decimal("8000.00"),
    lastInvoiceDate: new Date("2026-06-01"),
    lastCollectionDate: null,
    divisionId: "div-1",
    districtId: "dist-1",
    territoryId: "terr-1",
    division: { name: "Dhaka" },
    geoDistrict: { name: "Dhaka Metro" },
    geoTerritory: { name: "Zone A" },
    ownershipHistory: [{ assignedSr: { id: "sr-1", name: "SR One" } }],
  },
  {
    id: "d2",
    dealerCode: "T2-001",
    companyName: "Territory Two Dealer",
    currentBalance: new Prisma.Decimal("2000.00"),
    lastInvoiceDate: null,
    lastCollectionDate: null,
    divisionId: "div-2",
    districtId: "dist-2",
    territoryId: "terr-2",
    division: { name: "Chittagong" },
    geoDistrict: { name: "CTG Metro" },
    geoTerritory: { name: "Zone B" },
    ownershipHistory: [{ assignedSr: { id: "sr-2", name: "SR Two" } }],
  },
];

describe("Dashboard Certification — catalog", () => {
  it("defines checks for all 9 certification rules", () => {
    const ruleChecks = DASHBOARD_CERTIFICATION_CHECK_CATALOG.filter(
      (check) => check.ruleNumber !== undefined,
    );
    expect(ruleChecks.length).toBe(9);
    expect(ruleChecks.map((check) => check.ruleNumber).sort()).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });
});

describe("Rule 1 — SR isolation", () => {
  it("territory scope mode resolves SR to TERRITORIES", () => {
    expect(resolveTerritoryScopeMode("SR")).toBe("TERRITORIES");
  });

  it("SR stub client excludes foreign territory dealers", async () => {
    const client = makeDashboardCertStub(mixedTerritoryDealers);
    const isolated = await verifyDashboardSrIsolationBehavior(client);
    expect(isolated).toBe(true);
  });

  it("mergeDealerTerritoryScope filters to assigned territory", async () => {
    const scope = buildScopedTerritoryScope(["terr-1"]);
    const client = makeDashboardCertStub(mixedTerritoryDealers);
    const result = await getDueReport(
      { page: 1, pageSize: 50, includeZeroBalance: true, includeAdvance: true },
      scope,
      client,
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.dealerCode).toBe("T1-001");
  });
});

describe("Rule 2 — Manager isolation", () => {
  it("territory scope mode resolves Manager to TERRITORIES", () => {
    expect(resolveTerritoryScopeMode("Manager")).toBe("TERRITORIES");
  });

  it("territoryIdMatchesScope rejects foreign territories", () => {
    const scope = buildScopedTerritoryScope(["terr-1"]);
    expect(territoryIdMatchesScope(scope, "terr-1")).toBe(true);
    expect(territoryIdMatchesScope(scope, "terr-2")).toBe(false);
  });
});

describe("Rule 3 & 4 — global roles", () => {
  it("Accounts and Super_Admin resolve to ALL scope mode", () => {
    expect(resolveTerritoryScopeMode("Accounts")).toBe("ALL");
    expect(resolveTerritoryScopeMode("Super_Admin")).toBe("ALL");
  });
});

describe("Rule 5 — financial authority", () => {
  it("dashboard module has no forbidden financial writer imports", () => {
    const hits = scanDashboardFinancialBoundary();
    expect(hits).toHaveLength(0);
  });
});

describe("Rule 6 — KPI integrity", () => {
  it("verifyDashboardKpiParity matches due engine formatted totals", () => {
    const totalDue = new Prisma.Decimal("15000.50");
    const payload: DashboardPayload = {
      summary: {
        role: "Accounts",
        scopeKey: "dashboard.scope.all",
        titleKey: "dashboard.titles.accounts",
        kpis: [
          {
            id: "totalDue",
            labelKey: "dashboard.kpi.totalDue",
            value: formatMoney(totalDue),
          },
          {
            id: "companyReceivables",
            labelKey: "dashboard.kpi.companyReceivables",
            value: formatMoney(totalDue),
          },
        ],
      },
      widgets: {
        financialHealth: {
          id: "financialHealth",
          titleKey: "",
          statusKey: "",
          statusTone: "success",
          details: [],
        },
        reconciliationStatus: {
          id: "reconciliationStatus",
          titleKey: "",
          statusKey: "",
          statusTone: "success",
          details: [],
        },
        pendingAllocations: {
          id: "",
          titleKey: "",
          columns: [],
          rows: [],
          emptyKey: "",
        },
      },
      generatedAt: new Date().toISOString(),
    };

    expect(verifyDashboardKpiParity(payload, totalDue, totalDue)).toBe(true);
    expect(normalizeMoneyDisplay(formatMoney(totalDue))).toBe("15000.50");
  });
});

describe("Rule 7 — territory leakage scan", () => {
  it("dashboard-query findMany paths use territory merge helpers", () => {
    const hits = scanDashboardTerritoryLeakage();
    expect(hits).toHaveLength(0);
  });
});

describe("Rule 9 — architectural boundaries", () => {
  it("dashboard module has no forbidden imports", () => {
    const hits = scanDashboardArchitectureImports();
    expect(hits).toHaveLength(0);
  });

  it("dashboard UI has no client-side money calculations", () => {
    const hits = scanDashboardClientSideMoneyMath();
    expect(hits).toHaveLength(0);
  });

  it("documents static query surface count", () => {
    const count = countDashboardQuerySurface();
    expect(count).toBeGreaterThan(0);
  });
});

describe("Certification runner", () => {
  it("runAllDashboardCertificationChecks passes structural checks", async () => {
    const { checks } = await runAllDashboardCertificationChecks();
    const criticalFailures = checks.filter(
      (check) => !check.passed && check.severity === "critical",
    );
    expect(criticalFailures).toHaveLength(0);
  });

  it("buildDashboardCertificationResult produces production-ready score", async () => {
    const { result } = await buildDashboardCertificationResult();
    expect(result.overallScore).toBeGreaterThanOrEqual(9);
    expect(result.securityScore).toBeGreaterThanOrEqual(8);
    expect(result.financialScore).toBeGreaterThanOrEqual(8);
    expect(result.architectureScore).toBeGreaterThanOrEqual(8);
    expect(result.productionReady).toBe(true);
  });

  it("executive summary renders subsystem scores", async () => {
    const { result, checks } = await buildDashboardCertificationResult();
    const lines = buildDashboardCertificationExecutiveSummary({
      result,
      checks,
      remainingRisks: [],
      requiredManualChecks: [],
      generatedAt: new Date().toISOString(),
    });
    expect(lines.some((line) => line.includes("Security:"))).toBe(true);
    expect(lines.some((line) => line.includes("PHASE_09B"))).toBe(true);
  });

  it("computeOverallScore handles warnings at half weight", () => {
    const checks = [
      {
        id: "a",
        name: "pass",
        subsystem: "security" as const,
        category: "sr_isolation" as const,
        severity: "critical" as const,
        passed: true,
        warning: false,
        message: "ok",
        durationMs: 0,
      },
      {
        id: "b",
        name: "warn",
        subsystem: "performance" as const,
        category: "performance" as const,
        severity: "warning" as const,
        passed: true,
        warning: true,
        message: "warn",
        durationMs: 0,
      },
    ];
    const totals = computeOverallScore(checks);
    expect(totals.warningCount).toBe(1);
    expect(totals.overallScore).toBeGreaterThan(0);
  });

  it("aggregateSubsystemStatuses computes per-subsystem scores", () => {
    const sampleChecks = [
      {
        id: "s1",
        name: "security",
        subsystem: "security" as const,
        category: "sr_isolation" as const,
        severity: "critical" as const,
        passed: true,
        warning: false,
        message: "ok",
        durationMs: 0,
      },
    ];
    const subsystems = aggregateSubsystemStatuses(sampleChecks);
    expect(subsystems.security.score).toBe(10);
  });
});

describe("No duplicate calculations", () => {
  it("dashboard financial boundary scan finds zero balance recomputation", () => {
    expect(scanDashboardFinancialBoundary()).toHaveLength(0);
  });
});

describe("Empty-state and performance guard", () => {
  it("certification completes under one second without database", async () => {
    const started = performance.now();
    await runAllDashboardCertificationChecks();
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
