import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  getSrDealerStatement,
  getSrPerformanceOverview,
  getSrPerformancePrintPayload,
} from "./sr-performance-service";
import { buildAttributionDiagnostics } from "./sr-performance-query";
import type { SrPerformanceReadClient } from "./sr-performance-query";

function d(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function createClient(overrides?: {
  srs?: Array<{
    id: string;
    name: string;
    territoryIds: string[];
    territoryNames: string[];
  }>;
  dealers?: Array<{
    dealerCode: string;
    companyName: string;
    territoryId: string | null;
    territoryName: string | null;
    assignedSrId: string | null;
    activeOwnershipRows?: Array<{ assignedSrId: string | null }>;
  }>;
  openings?: Array<{ dealerCode: string; balance: Prisma.Decimal }>;
  movements?: Array<{
    dealerCode: string;
    sales: Prisma.Decimal;
    collection: Prisma.Decimal;
    ledger_movement: Prisma.Decimal;
    unsupported_count: number;
  }>;
}): SrPerformanceReadClient & { getQueryCount: () => number } {
  const srs = overrides?.srs ?? [
    {
      id: "sr-1",
      name: "SR One",
      territoryIds: ["t-1"],
      territoryNames: ["Dhaka North"],
    },
    {
      id: "sr-2",
      name: "SR Two",
      territoryIds: ["t-1"],
      territoryNames: ["Dhaka North"],
    },
  ];
  const dealers = overrides?.dealers ?? [
    {
      dealerCode: "D001",
      companyName: "Alpha Traders",
      territoryId: "t-1",
      territoryName: "Dhaka North",
      assignedSrId: "sr-1",
    },
    {
      dealerCode: "D002",
      companyName: "Beta Store",
      territoryId: "t-1",
      territoryName: "Dhaka North",
      assignedSrId: "sr-1",
    },
    {
      dealerCode: "D003",
      companyName: "Gamma Shop",
      territoryId: "t-1",
      territoryName: "Dhaka North",
      assignedSrId: "sr-2",
    },
  ];

  let queryCount = 0;

  const client = {
    user: {
      findMany: vi.fn(async () =>
        srs.map((sr) => ({
          id: sr.id,
          name: sr.name,
          territoryAssignments: sr.territoryIds.map((territoryId, index) => ({
            territoryId,
            territory: { name: sr.territoryNames[index] ?? territoryId },
          })),
        })),
      ),
    },
    userTerritoryAssignment: {
      findMany: vi.fn(async () =>
        srs.flatMap((sr) =>
          sr.territoryIds.map((territoryId) => ({
            territoryId,
            userId: sr.id,
          })),
        ),
      ),
    },
    dealer: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where?: {
            ownershipHistory?: {
              some?: { assignedSrId?: string | { in: string[] } };
            };
            OR?: unknown;
          };
        }) => {
          let rows = dealers;
          const assigned = where?.ownershipHistory?.some?.assignedSrId;
          if (typeof assigned === "string") {
            rows = rows.filter((row) => row.assignedSrId === assigned);
          } else if (
            assigned &&
            typeof assigned === "object" &&
            "in" in assigned
          ) {
            rows = rows.filter((row) =>
              row.assignedSrId ? assigned.in.includes(row.assignedSrId) : false,
            );
          }
          if (where?.OR) {
            // partySearch mocked as pass-through for non-filter tests
          }
          return rows.map((row) => {
            const ownership =
              row.activeOwnershipRows ??
              (row.assignedSrId
                ? [{ assignedSrId: row.assignedSrId }]
                : []);
            return {
              dealerCode: row.dealerCode,
              companyName: row.companyName,
              territoryId: row.territoryId,
              geoTerritory: row.territoryName
                ? { name: row.territoryName }
                : null,
              ownershipHistory: ownership,
            };
          });
        },
      ),
    },
    territory: {
      findMany: vi.fn(async () => [{ id: "t-1", name: "Dhaka North" }]),
    },
    ledgerEntry: {},
    $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
      queryCount += 1;
      const sql = strings.join(" ");
      if (sql.includes("DISTINCT ON")) {
        return (
          overrides?.openings ?? [
            { dealerCode: "D001", balance: d("100.00") },
            { dealerCode: "D002", balance: d("0.00") },
          ]
        );
      }
      return (
        overrides?.movements ?? [
          {
            dealerCode: "D001",
            sales: d("50.00"),
            collection: d("20.00"),
            ledger_movement: d("30.00"),
            unsupported_count: 0,
          },
          {
            dealerCode: "D002",
            sales: d("10.00"),
            collection: d("0.00"),
            ledger_movement: d("10.00"),
            unsupported_count: 0,
          },
          {
            dealerCode: "D003",
            sales: d("5.00"),
            collection: d("1.00"),
            ledger_movement: d("4.00"),
            unsupported_count: 0,
          },
        ]
      );
    }),
    getQueryCount: () => queryCount,
  };

  return client as unknown as SrPerformanceReadClient & {
    getQueryCount: () => number;
  };
}

describe("sr-performance-service aggregation", () => {
  const scope = { mode: "ALL" as const };
  const from = new Date(2026, 6, 1);
  const to = new Date(2026, 6, 31);

  it("aggregates multiple dealers under one SR", async () => {
    const client = createClient();
    const overview = await getSrPerformanceOverview(
      { from, to },
      scope,
      client,
    );
    const sr1 = overview.rows.find((row) => row.srId === "sr-1");
    expect(sr1?.dealerCount).toBe(2);
    expect(sr1?.previousDue.toFixed(2)).toBe("100.00");
    expect(sr1?.sales.toFixed(2)).toBe("60.00");
    expect(sr1?.collection.toFixed(2)).toBe("20.00");
    expect(sr1?.netBalance.toFixed(2)).toBe("140.00");
  });

  it("includes zero-activity active SR", async () => {
    const client = createClient({
      dealers: [
        {
          dealerCode: "D001",
          companyName: "Alpha Traders",
          territoryId: "t-1",
          territoryName: "Dhaka North",
          assignedSrId: "sr-1",
        },
      ],
      openings: [],
      movements: [],
    });
    const overview = await getSrPerformanceOverview(
      { from, to },
      scope,
      client,
    );
    const sr2 = overview.rows.find((row) => row.srId === "sr-2");
    expect(sr2).toBeDefined();
    expect(sr2?.dealerCount).toBe(0);
    expect(sr2?.netBalance.toFixed(2)).toBe("0.00");
  });

  it("selected SR detail totals equal overview row", async () => {
    const client = createClient();
    const [overview, statement] = await Promise.all([
      getSrPerformanceOverview({ from, to, srId: "sr-1" }, scope, client),
      getSrDealerStatement({ from, to, srId: "sr-1" }, scope, client),
    ]);
    const overviewRow = overview.rows.find((row) => row.srId === "sr-1");
    expect(overviewRow?.previousDue.toFixed(2)).toBe(
      statement.totals.previousDue.toFixed(2),
    );
    expect(overviewRow?.sales.toFixed(2)).toBe(statement.totals.sales.toFixed(2));
    expect(overviewRow?.collection.toFixed(2)).toBe(
      statement.totals.collection.toFixed(2),
    );
    expect(overviewRow?.netBalance.toFixed(2)).toBe(
      statement.totals.netBalance.toFixed(2),
    );
  });

  it("does not double-count dealers across overlapping territory SRs", async () => {
    const client = createClient();
    const overview = await getSrPerformanceOverview(
      { from, to },
      scope,
      client,
    );
    const totalDealers = overview.rows.reduce(
      (sum, row) => sum + row.dealerCount,
      0,
    );
    expect(totalDealers).toBe(3);
    // Territory overlap remains developer metadata, not a financial warning.
    expect(overview.diagnostics.overlappingTerritoryIds).toContain("t-1");
    expect(overview.diagnostics.attributionWarnings).toHaveLength(0);
    expect(overview.diagnostics.attribution.duplicateDealerAttributionCount).toBe(
      0,
    );
  });

  it("two SRs in one territory with unique ownership produces no attribution warning", async () => {
    const client = createClient();
    const overview = await getSrPerformanceOverview(
      { from, to },
      scope,
      client,
    );
    expect(overview.diagnostics.attributionWarnings).toEqual([]);
    expect(overview.diagnostics.attribution.ambiguousOwnershipCount).toBe(0);
  });

  it("multiple active ownership rows produce attribution diagnostic", async () => {
    const client = createClient({
      dealers: [
        {
          dealerCode: "D001",
          companyName: "Alpha Traders",
          territoryId: "t-1",
          territoryName: "Dhaka North",
          assignedSrId: "sr-1",
          activeOwnershipRows: [
            { assignedSrId: "sr-1" },
            { assignedSrId: "sr-2" },
          ],
        },
      ],
    });
    const overview = await getSrPerformanceOverview(
      { from, to },
      scope,
      client,
    );
    expect(overview.diagnostics.attribution.ambiguousOwnershipCount).toBe(1);
    expect(
      overview.diagnostics.attribution.duplicateDealerAttributionCount,
    ).toBe(1);
    expect(overview.diagnostics.attributionWarnings.length).toBeGreaterThan(0);
    expect(overview.diagnostics.attribution.affectedDealerCodes).toContain(
      "D001",
    );
  });

  it("clears invalid selected SR when outside allowed scope", async () => {
    const client = createClient({
      srs: [
        {
          id: "sr-1",
          name: "SR One",
          territoryIds: ["t-1"],
          territoryNames: ["Dhaka North"],
        },
      ],
    });
    const statement = await getSrDealerStatement(
      { from, to, srId: "sr-foreign" },
      { mode: "TERRITORIES", territoryIds: ["t-1"] },
      client,
    );
    expect(statement.selectedSr?.id).toBe("sr-1");
  });

  it("keeps financial query count bounded (anti-N+1)", async () => {
    const client = createClient();
    await getSrPerformanceOverview({ from, to }, scope, client);
    expect(client.getQueryCount()).toBeLessThanOrEqual(2);
  });

  it("unsupported postings surface reconciliation diagnostics", async () => {
    const client = createClient({
      openings: [{ dealerCode: "D001", balance: d("100.00") }],
      movements: [
        {
          dealerCode: "D001",
          sales: d("0.00"),
          collection: d("0.00"),
          ledger_movement: d("25.00"),
          unsupported_count: 1,
        },
      ],
      dealers: [
        {
          dealerCode: "D001",
          companyName: "Alpha Traders",
          territoryId: "t-1",
          territoryName: "Dhaka North",
          assignedSrId: "sr-1",
        },
      ],
    });
    const statement = await getSrDealerStatement(
      { from, to, srId: "sr-1" },
      scope,
      client,
    );
    expect(statement.rows[0]?.reconciliationDelta.toFixed(2)).toBe("25.00");
    expect(statement.diagnostics.unsupportedPostingCount).toBe(1);
    expect(statement.diagnostics.reconciliationWarnings.length).toBeGreaterThan(
      0,
    );
  });

  it("individual print requires authorized srId and returns only dealer rows", async () => {
    const client = createClient();
    await expect(
      getSrPerformancePrintPayload(
        { from, to, mode: "individual" },
        scope,
        client,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const payload = await getSrPerformancePrintPayload(
      { from, to, mode: "individual", srId: "sr-1" },
      scope,
      client,
    );
    expect(payload.mode).toBe("individual");
    expect(payload.individualRows.length).toBeGreaterThan(0);
    expect(payload.overviewRows).toHaveLength(0);
  });

  it("overview print returns only SR rows and ignores partySearch", async () => {
    const client = createClient();
    const payload = await getSrPerformancePrintPayload(
      {
        from,
        to,
        mode: "overview",
        partySearch: "should-be-ignored",
        srSearch: "One",
      },
      scope,
      client,
    );
    expect(payload.mode).toBe("overview");
    expect(payload.individualRows).toHaveLength(0);
    expect(payload.overviewRows.length).toBeGreaterThan(0);
    expect(payload.filters.partySearch).toBe("");
  });
});

describe("buildAttributionDiagnostics", () => {
  it("flags missing and duplicate attribution without territory overlap logic", () => {
    const result = buildAttributionDiagnostics([
      {
        dealerCode: "D001",
        activeOwnershipCount: 0,
        distinctAssignedSrCount: 0,
        assignedSrId: null,
      },
      {
        dealerCode: "D002",
        activeOwnershipCount: 2,
        distinctAssignedSrCount: 2,
        assignedSrId: "sr-1",
      },
      {
        dealerCode: "D003",
        activeOwnershipCount: 1,
        distinctAssignedSrCount: 1,
        assignedSrId: "sr-1",
      },
    ]);
    expect(result.missingOwnershipCount).toBe(1);
    expect(result.ambiguousOwnershipCount).toBe(1);
    expect(result.duplicateDealerAttributionCount).toBe(1);
    expect(result.affectedDealerCodes).toEqual(["D001", "D002"]);
  });
});
