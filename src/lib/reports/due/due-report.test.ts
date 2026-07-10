import { InvoiceStatus, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  accumulateInvoiceAging,
  classifyAgingBucket,
  computeDaysOverdue,
  createEmptyDueAging,
  getCompanyDueSummary,
  getDealerDueReport,
  getDueAgingReport,
  getDueReport,
  getSrDueReport,
  getTerritoryDueReport,
  resolveOwnershipAtDate,
  type DueReportReadClient,
} from "@/lib/reports/due";
import { mergeDealerTerritoryScope } from "@/lib/rbac/territory";
import type { TerritoryScope } from "@/lib/rbac/territory";

/**
 * Enterprise Due Report Engine tests — PHASE_08D.
 */

const ZERO = new Prisma.Decimal(0);
const ALL_SCOPE: TerritoryScope = { mode: "ALL" };
const TERRITORY_SCOPE: TerritoryScope = {
  mode: "TERRITORIES",
  territoryIds: ["terr-1"],
};

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

interface StubInvoice {
  id: string;
  dealerCode: string;
  dueDate: Date;
  issueDate: Date;
  grandTotal: Prisma.Decimal;
  collectionReceived: Prisma.Decimal;
  status: InvoiceStatus;
}

interface StubLedgerEntry {
  dealerCode: string;
  balance: Prisma.Decimal;
  postingDate: Date;
  id: string;
}

interface StubOwnership {
  dealerId: string;
  assignedSrId: string | null;
  assignedSr: { name: string } | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

function makeDueReportStub(options: {
  dealers?: StubDealer[];
  invoices?: StubInvoice[];
  ledger?: StubLedgerEntry[];
  ownership?: StubOwnership[];
}) {
  const dealers = [...(options.dealers ?? [])];
  const invoices = [...(options.invoices ?? [])];
  const ledger = [...(options.ledger ?? [])];
  const ownership = [...(options.ownership ?? [])];

  const client = {
    dealer: {
      findMany: async ({
        where,
        skip,
        take,
      }: {
        where?: {
          isActive?: boolean;
          territoryId?: { in?: string[] };
          AND?: unknown[];
          dealerCode?: string | { in?: string[] };
        };
        skip?: number;
        take?: number;
      }) => {
        let rows = dealers.filter(() => true);

        if (where?.territoryId?.in) {
          const allowed = new Set(where.territoryId.in);
          rows = rows.filter(
            (d) => d.territoryId && allowed.has(d.territoryId),
          );
        }

        if (where?.dealerCode) {
          if (typeof where.dealerCode === "string") {
            rows = rows.filter((d) => d.dealerCode === where.dealerCode);
          } else if (where.dealerCode.in) {
            const allowed = new Set(where.dealerCode.in);
            rows = rows.filter((d) => allowed.has(d.dealerCode));
          }
        }

        if (where?.AND) {
          for (const clause of where.AND as Array<Record<string, unknown>>) {
            if (clause.AND) {
              for (const nested of clause.AND as Array<Record<string, unknown>>) {
                applyClause(rows, nested);
              }
            } else {
              applyClause(rows, clause);
            }
          }
        }

        function applyClause(
          rowsRef: { filter: (fn: (d: StubDealer) => boolean) => StubDealer[] },
          clause: Record<string, unknown>,
        ) {
          if (clause.territoryId && typeof clause.territoryId === "object") {
            const filter = clause.territoryId as { in?: string[] };
            if (filter.in) {
              const allowed = new Set(filter.in);
              rows = rows.filter(
                (d) => d.territoryId && allowed.has(d.territoryId),
              );
            }
          }
          if (clause.currentBalance) {
            const balanceFilter = clause.currentBalance as {
              gt?: Prisma.Decimal;
              gte?: Prisma.Decimal;
              lte?: Prisma.Decimal;
              not?: Prisma.Decimal;
            };
            if (balanceFilter.gt) {
              rows = rows.filter((d) => d.currentBalance.greaterThan(balanceFilter.gt!));
            }
            if (balanceFilter.gte) {
              rows = rows.filter((d) =>
                d.currentBalance.greaterThanOrEqualTo(balanceFilter.gte!),
              );
            }
            if (balanceFilter.lte) {
              rows = rows.filter((d) =>
                d.currentBalance.lessThanOrEqualTo(balanceFilter.lte!),
              );
            }
            if (balanceFilter.not !== undefined) {
              rows = rows.filter((d) => !d.currentBalance.equals(ZERO));
            }
          }
          if (clause.dealerCode && typeof clause.dealerCode === "object") {
            const codeFilter = clause.dealerCode as { in?: string[] };
            if (codeFilter.in) {
              const allowed = new Set(codeFilter.in);
              rows = rows.filter((d) => allowed.has(d.dealerCode));
            }
          }
        }

        rows.sort((a, b) => b.currentBalance.minus(a.currentBalance).toNumber());

        if (skip !== undefined || take !== undefined) {
          const start = skip ?? 0;
          const end = take !== undefined ? start + take : undefined;
          rows = rows.slice(start, end);
        }

        return rows;
      },
      count: async (args: Parameters<typeof client.dealer.findMany>[0]) => {
        const rows = await client.dealer.findMany(args);
        return rows.length;
      },
      findUnique: async ({ where }: { where: { dealerCode: string } }) =>
        dealers.find((d) => d.dealerCode === where.dealerCode) ?? null,
    },
    invoice: {
      findMany: async ({
        where,
      }: {
        where?: {
          status?: { in?: InvoiceStatus[] };
          dealer?: Record<string, unknown>;
        };
      }) => {
        let rows = invoices;
        if (where?.status?.in) {
          const allowed = new Set(where.status.in);
          rows = rows.filter((inv) => allowed.has(inv.status));
        }
        return rows;
      },
    },
    ledgerEntry: {
      findMany: async ({
        where,
        distinct,
      }: {
        where?: { dealerCode?: { in?: string[] } };
        distinct?: string[];
      }) => {
        let rows = ledger;
        if (where?.dealerCode?.in) {
          const allowed = new Set(where.dealerCode.in);
          rows = rows.filter((entry) => allowed.has(entry.dealerCode));
        }
        if (distinct?.includes("dealerCode")) {
          const seen = new Set<string>();
          const unique: StubLedgerEntry[] = [];
          for (const entry of [...rows].sort(
            (a, b) => b.postingDate.getTime() - a.postingDate.getTime(),
          )) {
            if (!seen.has(entry.dealerCode)) {
              seen.add(entry.dealerCode);
              unique.push(entry);
            }
          }
          return unique;
        }
        return rows;
      },
    },
    dealerOwnershipHistory: {
      findMany: async ({
        where,
      }: {
        where?: { dealerId?: { in?: string[] } };
      }) => {
        let rows = ownership;
        if (where?.dealerId?.in) {
          const allowed = new Set(where.dealerId.in);
          rows = rows.filter((row) => allowed.has(row.dealerId));
        }
        return rows;
      },
    },
    user: {} as DueReportReadClient["dealer"],
  } as DueReportReadClient;

  return client;
}

const baseDealers: StubDealer[] = [
  {
    id: "dealer-1",
    dealerCode: "D001",
    companyName: "Due Dealer",
    currentBalance: new Prisma.Decimal("5000.00"),
    lastInvoiceDate: new Date("2026-06-01"),
    lastCollectionDate: new Date("2026-05-15"),
    divisionId: "div-1",
    districtId: "dist-1",
    territoryId: "terr-1",
    division: { name: "Dhaka" },
    geoDistrict: { name: "Dhaka Metro" },
    geoTerritory: { name: "Zone A" },
    ownershipHistory: [{ assignedSr: { id: "sr-1", name: "SR One" } }],
  },
  {
    id: "dealer-2",
    dealerCode: "D002",
    companyName: "Advance Dealer",
    currentBalance: new Prisma.Decimal("-1500.00"),
    lastInvoiceDate: new Date("2026-05-01"),
    lastCollectionDate: new Date("2026-06-01"),
    divisionId: "div-1",
    districtId: "dist-1",
    territoryId: "terr-1",
    division: { name: "Dhaka" },
    geoDistrict: { name: "Dhaka Metro" },
    geoTerritory: { name: "Zone A" },
    ownershipHistory: [{ assignedSr: { id: "sr-1", name: "SR One" } }],
  },
  {
    id: "dealer-3",
    dealerCode: "D003",
    companyName: "Zero Dealer",
    currentBalance: ZERO,
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

describe("due-aging", () => {
  it("classifies aging buckets by days overdue", () => {
    expect(classifyAgingBucket(0)).toBe("current");
    expect(classifyAgingBucket(15)).toBe("days30");
    expect(classifyAgingBucket(45)).toBe("days60");
    expect(classifyAgingBucket(75)).toBe("days90");
    expect(classifyAgingBucket(120)).toBe("days90Plus");
  });

  it("accumulates invoice outstanding into aging buckets", () => {
    const asOf = new Date("2026-07-11");
    const aging = accumulateInvoiceAging(
      [
        {
          dueDate: new Date("2026-07-15"),
          grandTotal: new Prisma.Decimal("1000"),
          collectionReceived: ZERO,
          status: InvoiceStatus.Issued,
        },
        {
          dueDate: new Date("2026-06-01"),
          grandTotal: new Prisma.Decimal("2000"),
          collectionReceived: new Prisma.Decimal("500"),
          status: InvoiceStatus.Partial,
        },
      ],
      asOf,
    );

    expect(aging.current.toFixed(2)).toBe("1000.00");
    expect(aging.days60.toFixed(2)).toBe("1500.00");
    expect(aging.days30.toFixed(2)).toBe("0.00");
  });
});

describe("getDueReport", () => {
  it("returns dealers with positive due balance", async () => {
    const client = makeDueReportStub({
      dealers: baseDealers,
      ledger: [
        {
          dealerCode: "D001",
          balance: new Prisma.Decimal("5000.00"),
          postingDate: new Date(),
          id: "le-1",
        },
      ],
    });

    const result = await getDueReport(
      { page: 1, pageSize: 50, includeZeroBalance: false, includeAdvance: false },
      ALL_SCOPE,
      client,
    );

    expect(result.total).toBe(1);
    expect(result.rows[0].dealerCode).toBe("D001");
    expect(result.rows[0].currentBalance.toFixed(2)).toBe("5000.00");
  });

  it("includes advance dealer when includeAdvance is true", async () => {
    const client = makeDueReportStub({ dealers: baseDealers });

    const result = await getDueReport(
      { page: 1, pageSize: 50, includeZeroBalance: false, includeAdvance: true },
      ALL_SCOPE,
      client,
    );

    const advance = result.rows.find((row) => row.dealerCode === "D002");
    expect(advance?.currentBalance.toFixed(2)).toBe("-1500.00");
  });

  it("excludes zero-balance dealers by default", async () => {
    const client = makeDueReportStub({ dealers: baseDealers });

    const result = await getDueReport(
      { page: 1, pageSize: 50, includeZeroBalance: false, includeAdvance: false },
      ALL_SCOPE,
      client,
    );

    expect(result.rows.every((row) => row.dealerCode !== "D003")).toBe(true);
  });

  it("returns empty report when no dealers match", async () => {
    const client = makeDueReportStub({ dealers: [] });

    const result = await getDueReport(
      { page: 1, pageSize: 50, includeZeroBalance: false, includeAdvance: true },
      ALL_SCOPE,
      client,
    );

    expect(result.total).toBe(0);
    expect(result.rows).toEqual([]);
  });

  it("respects territory RBAC scope", async () => {
    const client = makeDueReportStub({ dealers: baseDealers });

    const result = await getDueReport(
      { page: 1, pageSize: 50, includeZeroBalance: true, includeAdvance: true },
      TERRITORY_SCOPE,
      client,
    );

    expect(result.rows.every((row) => row.territoryName === "Zone A")).toBe(true);
    expect(result.total).toBe(2);
  });

  it("handles large dataset with pagination", async () => {
    const manyDealers = Array.from({ length: 120 }, (_, index) => ({
      id: `dealer-${index}`,
      dealerCode: `D${String(index).padStart(3, "0")}`,
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

    const client = makeDueReportStub({ dealers: manyDealers });

    const page1 = await getDueReport(
      { page: 1, pageSize: 50, includeZeroBalance: true, includeAdvance: true },
      ALL_SCOPE,
      client,
    );
    const page2 = await getDueReport(
      { page: 2, pageSize: 50, includeZeroBalance: true, includeAdvance: true },
      ALL_SCOPE,
      client,
    );

    expect(page1.rows).toHaveLength(50);
    expect(page2.rows).toHaveLength(50);
    expect(page1.total).toBe(120);
    expect(page1.pageCount).toBe(3);
  });
});

describe("getDealerDueReport", () => {
  it("returns a single dealer due row", async () => {
    const client = makeDueReportStub({
      dealers: baseDealers,
      ledger: [
        {
          dealerCode: "D001",
          balance: new Prisma.Decimal("5000.00"),
          postingDate: new Date(),
          id: "le-1",
        },
      ],
    });

    const row = await getDealerDueReport({ dealerCode: "D001" }, client);
    expect(row.dealerName).toBe("Due Dealer");
    expect(row.ledgerIntegrity).toBe(true);
  });
});

describe("getTerritoryDueReport", () => {
  it("aggregates due by territory", async () => {
    const client = makeDueReportStub({ dealers: baseDealers, invoices: [] });

    const result = await getTerritoryDueReport(
      { groupBy: "territory" },
      ALL_SCOPE,
      client,
    );

    const zoneA = result.groups.find((g) => g.groupName === "Zone A");
    expect(zoneA?.dealerCount).toBe(2);
    expect(zoneA?.totalDue.toFixed(2)).toBe("5000.00");
    expect(zoneA?.totalAdvance.toFixed(2)).toBe("1500.00");
  });
});

describe("getSrDueReport", () => {
  it("aggregates due by assigned SR", async () => {
    const client = makeDueReportStub({ dealers: baseDealers, invoices: [] });

    const result = await getSrDueReport({}, ALL_SCOPE, client);

    const srOne = result.groups.find((g) => g.srName === "SR One");
    expect(srOne?.dealerCount).toBe(2);
    expect(srOne?.totalDue.toFixed(2)).toBe("5000.00");
  });
});

describe("getCompanyDueSummary", () => {
  it("summarizes company-wide due totals", async () => {
    const client = makeDueReportStub({
      dealers: baseDealers,
      invoices: [
        {
          id: "inv-1",
          dealerCode: "D001",
          dueDate: new Date("2026-06-01"),
          issueDate: new Date("2026-05-20"),
          grandTotal: new Prisma.Decimal("3000"),
          collectionReceived: ZERO,
          status: InvoiceStatus.Issued,
        },
      ],
    });

    const summary = await getCompanyDueSummary({}, ALL_SCOPE, client);

    expect(summary.totalDealers).toBe(3);
    expect(summary.dealersWithDue).toBe(1);
    expect(summary.dealersWithAdvance).toBe(1);
    expect(summary.totalDue.toFixed(2)).toBe("5000.00");
    expect(summary.totalAdvance.toFixed(2)).toBe("1500.00");
  });
});

describe("getDueAgingReport", () => {
  it("attributes invoices to historical ownership at issue date", async () => {
    const client = makeDueReportStub({
      dealers: [baseDealers[0]],
      invoices: [
        {
          id: "inv-old",
          dealerCode: "D001",
          dueDate: new Date("2026-05-01"),
          issueDate: new Date("2026-04-01"),
          grandTotal: new Prisma.Decimal("1000"),
          collectionReceived: ZERO,
          status: InvoiceStatus.Issued,
        },
        {
          id: "inv-new",
          dealerCode: "D001",
          dueDate: new Date("2026-06-01"),
          issueDate: new Date("2026-06-01"),
          grandTotal: new Prisma.Decimal("2000"),
          collectionReceived: ZERO,
          status: InvoiceStatus.Issued,
        },
      ],
      ownership: [
        {
          dealerId: "dealer-1",
          assignedSrId: "sr-old",
          assignedSr: { name: "Old SR" },
          effectiveFrom: new Date("2026-01-01"),
          effectiveTo: new Date("2026-05-15"),
        },
        {
          dealerId: "dealer-1",
          assignedSrId: "sr-1",
          assignedSr: { name: "SR One" },
          effectiveFrom: new Date("2026-05-15"),
          effectiveTo: null,
        },
      ],
    });

    const oldSrReport = await getDueAgingReport(
      { assignedSrId: "sr-old", asOfDate: new Date("2026-07-11") },
      ALL_SCOPE,
      client,
    );
    const newSrReport = await getDueAgingReport(
      { assignedSrId: "sr-1", asOfDate: new Date("2026-07-11") },
      ALL_SCOPE,
      client,
    );

    const oldTotal =
      oldSrReport.aging.current
        .plus(oldSrReport.aging.days30)
        .plus(oldSrReport.aging.days60)
        .plus(oldSrReport.aging.days90)
        .plus(oldSrReport.aging.days90Plus);
    const newTotal =
      newSrReport.aging.current
        .plus(newSrReport.aging.days30)
        .plus(newSrReport.aging.days60)
        .plus(newSrReport.aging.days90)
        .plus(newSrReport.aging.days90Plus);

    expect(oldTotal.toFixed(2)).toBe("1000.00");
    expect(newTotal.toFixed(2)).toBe("2000.00");
  });
});

describe("ownership resolution", () => {
  it("resolves ownership at a specific date", () => {
    const histories = [
      {
        dealerId: "dealer-1",
        assignedSrId: "sr-old",
        assignedSrName: "Old SR",
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: new Date("2026-05-15"),
      },
      {
        dealerId: "dealer-1",
        assignedSrId: "sr-new",
        assignedSrName: "New SR",
        effectiveFrom: new Date("2026-05-15"),
        effectiveTo: null,
      },
    ];

    const atApril = resolveOwnershipAtDate(
      histories,
      "dealer-1",
      new Date("2026-04-01"),
    );
    const atJune = resolveOwnershipAtDate(
      histories,
      "dealer-1",
      new Date("2026-06-01"),
    );

    expect(atApril?.assignedSrId).toBe("sr-old");
    expect(atJune?.assignedSrId).toBe("sr-new");
  });
});

describe("territory RBAC filters", () => {
  it("mergeDealerTerritoryScope restricts to assigned territories", () => {
    const scoped = mergeDealerTerritoryScope(
      { isActive: true },
      TERRITORY_SCOPE,
    );
    expect(scoped).toEqual({
      AND: [{ isActive: true }, { territoryId: { in: ["terr-1"] } }],
    });
  });
});

describe("computeDaysOverdue", () => {
  it("returns zero when not yet overdue", () => {
    const days = computeDaysOverdue(
      new Date("2026-07-15"),
      new Date("2026-07-11"),
    );
    expect(days).toBe(0);
  });

  it("returns correct days when overdue", () => {
    const days = computeDaysOverdue(
      new Date("2026-06-01"),
      new Date("2026-07-11"),
    );
    expect(days).toBe(40);
  });
});

describe("empty aging", () => {
  it("returns zero buckets when no invoices", () => {
    const aging = createEmptyDueAging();
    expect(aging.current.toFixed(2)).toBe("0.00");
    expect(aging.days90Plus.toFixed(2)).toBe("0.00");
  });
});
