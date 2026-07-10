import { InvoiceStatus, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  aggregateSubsystemStatuses,
  buildCertificationExecutiveSummary,
  buildTerritoryCertificationResult,
  computeOverallScore,
  reconcileAgingAgainstBalance,
  runAllTerritoryCertificationChecks,
  scanClientSideDueCalculations,
  scanDuplicatedDueLogic,
  scanRogueTerritoryChecks,
  TERRITORY_CERTIFICATION_CHECK_CATALOG,
  verifySrIsolationBehavior,
} from "@/lib/certification/territory";
import {
  classifyAgingBucket,
  getDueReport,
  resolveOwnershipAtDate,
  type DueReportReadClient,
} from "@/lib/reports/due";
import {
  buildScopedTerritoryScope,
  mergeDealerTerritoryScope,
  resolveTerritoryScopeMode,
  territoryIdMatchesScope,
} from "@/lib/rbac/territory";

/**
 * Enterprise Territory & Due Certification tests — PHASE_08E.
 */

const ZERO = new Prisma.Decimal(0);

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

function makeCertificationStub(dealers: StubDealer[]): DueReportReadClient {
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
        const rows = await makeCertificationStub(dealers).dealer.findMany(args);
        return rows.length;
      },
      findUnique: async ({ where }: { where: { dealerCode: string } }) =>
        dealers.find((d) => d.dealerCode === where.dealerCode) ?? null,
    },
    invoice: { findMany: async () => [] },
    ledgerEntry: { findMany: async () => [] },
  } as DueReportReadClient;
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

describe("Territory Certification — catalog", () => {
  it("defines checks for all 8 certification rules", () => {
    const ruleChecks = TERRITORY_CERTIFICATION_CHECK_CATALOG.filter(
      (check) => check.ruleNumber !== undefined,
    );
    expect(ruleChecks).toHaveLength(8);
    expect(ruleChecks.map((check) => check.ruleNumber).sort()).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });
});

describe("Territory Certification — repository scans", () => {
  it("finds no duplicated due balance logic outside due module", () => {
    expect(scanDuplicatedDueLogic()).toEqual([]);
  });

  it("finds no rogue territory checks in server actions", () => {
    expect(scanRogueTerritoryChecks()).toEqual([]);
  });

  it("finds no forbidden client-side due calculations in report UI", () => {
    expect(scanClientSideDueCalculations()).toEqual([]);
  });
});

describe("Territory Certification — SR isolation", () => {
  it("scopes SR to assigned territory dealers only", async () => {
    const client = makeCertificationStub(mixedTerritoryDealers);
    const isolated = await verifySrIsolationBehavior(client);
    expect(isolated).toBe(true);

    const result = await getDueReport(
      { page: 1, pageSize: 50, includeZeroBalance: true, includeAdvance: true },
      { mode: "TERRITORIES", territoryIds: ["terr-1"] },
      client,
    );

    expect(result.total).toBe(1);
    expect(result.rows[0]?.dealerCode).toBe("T1-001");
  });
});

describe("Territory Certification — manager isolation", () => {
  it("manager uses TERRITORIES scope mode", () => {
    expect(resolveTerritoryScopeMode("Manager")).toBe("TERRITORIES");
    const scope = buildScopedTerritoryScope(["mgr-t1"]);
    const merged = mergeDealerTerritoryScope({}, scope);
    expect(JSON.stringify(merged)).toContain("mgr-t1");
    expect(territoryIdMatchesScope(scope, "mgr-t1")).toBe(true);
    expect(territoryIdMatchesScope(scope, "other")).toBe(false);
  });
});

describe("Territory Certification — dealer transfer history", () => {
  it("resolves ownership snapshot before and after transfer", () => {
    const histories = [
      {
        dealerId: "d1",
        assignedSrId: "sr-old",
        assignedSrName: "Old SR",
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: new Date("2026-05-15"),
      },
      {
        dealerId: "d1",
        assignedSrId: "sr-new",
        assignedSrName: "New SR",
        effectiveFrom: new Date("2026-05-15"),
        effectiveTo: null,
      },
    ];

    const oldInvoiceOwner = resolveOwnershipAtDate(
      histories,
      "d1",
      new Date("2026-04-15"),
    );
    const newInvoiceOwner = resolveOwnershipAtDate(
      histories,
      "d1",
      new Date("2026-06-01"),
    );

    expect(oldInvoiceOwner?.assignedSrId).toBe("sr-old");
    expect(newInvoiceOwner?.assignedSrId).toBe("sr-new");
  });
});

describe("Territory Certification — due aging", () => {
  it("classifies aging buckets per Rule 6", () => {
    expect(classifyAgingBucket(0)).toBe("current");
    expect(classifyAgingBucket(30)).toBe("days30");
    expect(classifyAgingBucket(31)).toBe("days60");
    expect(classifyAgingBucket(61)).toBe("days90");
    expect(classifyAgingBucket(91)).toBe("days90Plus");
  });
});

describe("Territory Certification — advance balance", () => {
  it("documents advance payment as aging vs balance delta", () => {
    const reconciliation = reconcileAgingAgainstBalance(
      {
        dealerCode: "ADV-001",
        currentBalance: new Prisma.Decimal("-2500.00"),
        hasOpeningBalance: false,
        hasUnallocatedCollections: false,
        invoices: [],
      },
      new Date("2026-07-11"),
    );

    expect(reconciliation.delta).toBe("-2500.00");
    expect(reconciliation.explainedBy).toContain("advance_payment");
  });
});

describe("Territory Certification — opening balance", () => {
  it("documents opening balance as aging vs balance delta", () => {
    const reconciliation = reconcileAgingAgainstBalance(
      {
        dealerCode: "OB-001",
        currentBalance: new Prisma.Decimal("5000.00"),
        hasOpeningBalance: true,
        hasUnallocatedCollections: false,
        invoices: [
          {
            dueDate: new Date("2026-06-01"),
            grandTotal: new Prisma.Decimal("2000.00"),
            collectionReceived: ZERO,
            status: InvoiceStatus.Issued,
          },
        ],
      },
      new Date("2026-07-11"),
    );

    expect(reconciliation.explainedBy).toContain("opening_balance");
    expect(Number.parseFloat(reconciliation.delta)).not.toBe(0);
  });
});

describe("Territory Certification — ownership snapshot", () => {
  it("attributes historical invoices to ownership at issue date", () => {
    const histories = [
      {
        dealerId: "dealer-x",
        assignedSrId: "sr-a",
        assignedSrName: "SR A",
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: new Date("2026-03-01"),
      },
      {
        dealerId: "dealer-x",
        assignedSrId: "sr-b",
        assignedSrName: "SR B",
        effectiveFrom: new Date("2026-03-01"),
        effectiveTo: null,
      },
    ];

    const atFeb = resolveOwnershipAtDate(histories, "dealer-x", new Date("2026-02-01"));
    const atApril = resolveOwnershipAtDate(histories, "dealer-x", new Date("2026-04-01"));

    expect(atFeb?.assignedSrName).toBe("SR A");
    expect(atApril?.assignedSrName).toBe("SR B");
  });
});

describe("Territory Certification — mixed territory dataset", () => {
  it("returns only in-scope dealers for territory-scoped query", async () => {
    const client = makeCertificationStub(mixedTerritoryDealers);

    const terr1 = await getDueReport(
      { page: 1, pageSize: 50, includeZeroBalance: true, includeAdvance: true },
      { mode: "TERRITORIES", territoryIds: ["terr-1"] },
      client,
    );
    const terr2 = await getDueReport(
      { page: 1, pageSize: 50, includeZeroBalance: true, includeAdvance: true },
      { mode: "TERRITORIES", territoryIds: ["terr-2"] },
      client,
    );

    expect(terr1.rows).toHaveLength(1);
    expect(terr2.rows).toHaveLength(1);
    expect(terr1.rows[0]?.dealerCode).toBe("T1-001");
    expect(terr2.rows[0]?.dealerCode).toBe("T2-001");
  });
});

describe("Territory Certification — large dataset", () => {
  it("supports paginated due report queries", async () => {
    const manyDealers: StubDealer[] = Array.from({ length: 150 }, (_, index) => ({
      id: `d-${index}`,
      dealerCode: `LD-${String(index).padStart(3, "0")}`,
      companyName: `Dealer ${index}`,
      currentBalance: new Prisma.Decimal(index + 1),
      lastInvoiceDate: null,
      lastCollectionDate: null,
      divisionId: "div-1",
      districtId: "dist-1",
      territoryId: "terr-1",
      division: { name: "Dhaka" },
      geoDistrict: { name: "Dhaka Metro" },
      geoTerritory: { name: "Zone A" },
      ownershipHistory: [],
    }));

    const client = makeCertificationStub(manyDealers);
    const page1 = await getDueReport(
      { page: 1, pageSize: 50, includeZeroBalance: true, includeAdvance: true },
      { mode: "ALL" },
      client,
    );
    const page2 = await getDueReport(
      { page: 2, pageSize: 50, includeZeroBalance: true, includeAdvance: true },
      { mode: "ALL" },
      client,
    );

    expect(page1.rows).toHaveLength(50);
    expect(page2.rows).toHaveLength(50);
    expect(page1.total).toBe(150);
    expect(page1.pageCount).toBe(3);
  });
});

describe("Territory Certification — scoring", () => {
  it("computes overall score with warning weighting", () => {
    const totals = computeOverallScore([
      {
        id: "A",
        name: "A",
        subsystem: "territorySecurity",
        category: "territory_rbac",
        severity: "critical",
        passed: true,
        warning: false,
        message: "ok",
        durationMs: 1,
      },
      {
        id: "B",
        name: "B",
        subsystem: "dueAccuracy",
        category: "due_reporting",
        severity: "warning",
        passed: true,
        warning: true,
        message: "warn",
        durationMs: 1,
      },
    ]);

    expect(totals.passedChecks).toBe(1);
    expect(totals.warnings).toBe(1);
    expect(totals.overallScore).toBeGreaterThan(0);
    expect(totals.overallScore).toBeLessThan(10);
  });

  it("aggregates subsystem statuses", () => {
    const subsystems = aggregateSubsystemStatuses([
      {
        id: "R1",
        name: "R1",
        subsystem: "territorySecurity",
        category: "territory_rbac",
        severity: "critical",
        passed: true,
        warning: false,
        message: "ok",
        durationMs: 1,
      },
      {
        id: "R2",
        name: "R2",
        subsystem: "dueAccuracy",
        category: "due_reporting",
        severity: "critical",
        passed: true,
        warning: false,
        message: "ok",
        durationMs: 1,
      },
    ]);

    expect(subsystems.territorySecurity.passedChecks).toBe(1);
    expect(subsystems.dueAccuracy.score).toBe(10);
  });
});

describe("Territory Certification — full runner", () => {
  it("runs all structural checks without database", async () => {
    const { checks, agingReconciliations } = await runAllTerritoryCertificationChecks();

    expect(checks.length).toBeGreaterThanOrEqual(14);
    expect(agingReconciliations.length).toBe(3);

    const criticalFailures = checks.filter(
      (check) => !check.passed && check.severity === "critical",
    );
    expect(criticalFailures).toHaveLength(0);
  });

  it("builds certification result with subsystem scores", async () => {
    const { result } = await buildTerritoryCertificationResult();

    expect(result.certificationVersion).toBe("1.0.0");
    expect(result.territorySecurityScore).toBeGreaterThan(0);
    expect(result.ownershipIntegrityScore).toBeGreaterThan(0);
    expect(result.dueAccuracyScore).toBeGreaterThan(0);
    expect(result.financialBoundaryScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeGreaterThanOrEqual(9);
  });

  it("builds executive summary report", async () => {
    const { buildTerritoryCertificationReport } = await import(
      "./territory-certification-report"
    );
    const report = await buildTerritoryCertificationReport();
    const summary = buildCertificationExecutiveSummary(report);

    expect(summary.some((line) => line.includes("Subsystem Scores"))).toBe(true);
    expect(summary.some((line) => line.includes("Aging vs Balance"))).toBe(true);
    expect(report.agingReconciliations.length).toBeGreaterThan(0);
  });
});
