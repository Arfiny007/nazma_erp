import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import {
  classifyBackfillReason,
  getLedgerBackfillCandidates,
  requiresBackfill,
  toBackfillCandidate,
} from "@/lib/ledger/backfill";
import type { BackfillReadClient } from "@/lib/ledger/backfill";

type StubDealer = {
  dealerCode: string;
  companyName: string;
  currentBalance: Prisma.Decimal;
};

type StubLedgerRow = {
  id: string;
  dealerCode: string;
  postingDate: Date;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  balance: Prisma.Decimal;
};

type StubInvoice = {
  dealerCode: string;
  status: string;
};

type StubCollection = {
  dealerCode: string;
  status: string;
};

type StubOpeningBalance = {
  dealerCode: string;
  status: string;
};

function makeDiscoveryStub(options: {
  dealers?: StubDealer[];
  ledger?: StubLedgerRow[];
  invoices?: StubInvoice[];
  collections?: StubCollection[];
  openingBalances?: StubOpeningBalance[];
}) {
  const dealers = options.dealers ?? [];
  const ledger = options.ledger ?? [];
  const invoices = options.invoices ?? [];
  const collections = options.collections ?? [];
  const openingBalances = options.openingBalances ?? [];

  const client = {
    dealer: {
      findMany: async () =>
        dealers.map((dealer) => ({
          dealerCode: dealer.dealerCode,
          companyName: dealer.companyName,
          currentBalance: dealer.currentBalance,
        })),
    },
    ledgerEntry: {
      groupBy: async () => {
        const counts = new Map<string, number>();
        for (const row of ledger) {
          counts.set(row.dealerCode, (counts.get(row.dealerCode) ?? 0) + 1);
        }
        return [...counts.entries()].map(([dealerCode, count]) => ({
          dealerCode,
          _count: { _all: count },
        }));
      },
      findFirst: async ({
        where,
        orderBy,
      }: {
        where: { dealerCode: string };
        orderBy: Array<{ postingDate: "desc" | "asc" } | { id: "desc" | "asc" }>;
      }) => {
        const rows = ledger
          .filter((row) => row.dealerCode === where.dealerCode)
          .sort((a, b) => {
            for (const clause of orderBy) {
              if ("postingDate" in clause) {
                const dir = clause.postingDate === "desc" ? -1 : 1;
                const cmp = a.postingDate.getTime() - b.postingDate.getTime();
                if (cmp !== 0) return cmp * dir;
              }
              if ("id" in clause) {
                const dir = clause.id === "desc" ? -1 : 1;
                const cmp = a.id.localeCompare(b.id);
                if (cmp !== 0) return cmp * dir;
              }
            }
            return 0;
          });
        return rows[0] ?? null;
      },
    },
    invoice: {
      groupBy: async ({
        where,
      }: {
        where?: { status?: { in?: string[] } };
      }) => {
        const allowed = new Set(where?.status?.in ?? []);
        const counts = new Map<string, number>();
        for (const invoice of invoices) {
          if (allowed.size > 0 && !allowed.has(invoice.status)) {
            continue;
          }
          counts.set(
            invoice.dealerCode,
            (counts.get(invoice.dealerCode) ?? 0) + 1,
          );
        }
        return [...counts.entries()].map(([dealerCode, count]) => ({
          dealerCode,
          _count: { _all: count },
        }));
      },
    },
    collection: {
      groupBy: async ({
        where,
      }: {
        where?: { status?: { in?: string[] } };
      }) => {
        const allowed = new Set(where?.status?.in ?? []);
        const counts = new Map<string, number>();
        for (const collection of collections) {
          if (allowed.size > 0 && !allowed.has(collection.status)) {
            continue;
          }
          counts.set(
            collection.dealerCode,
            (counts.get(collection.dealerCode) ?? 0) + 1,
          );
        }
        return [...counts.entries()].map(([dealerCode, count]) => ({
          dealerCode,
          _count: { _all: count },
        }));
      },
    },
    openingBalance: {
      findMany: async ({
        where,
      }: {
        where?: { status?: { in?: string[] } };
      }) => {
        const allowed = new Set(where?.status?.in ?? []);
        return openingBalances
          .filter((row) => allowed.size === 0 || allowed.has(row.status))
          .map((row) => ({ dealerCode: row.dealerCode }));
      },
    },
  } as unknown as BackfillReadClient;

  return client;
}

describe("ledger backfill discovery — PHASE_07E1", () => {
  it("returns empty result for an empty database", async () => {
    const client = makeDiscoveryStub({ dealers: [] });
    const result = await getLedgerBackfillCandidates(client);

    expect(result.candidates).toEqual([]);
    expect(result.summary).toEqual({
      dealerCount: 0,
      requiresBackfillCount: 0,
      reconciledCount: 0,
      noLedgerCount: 0,
      partialLedgerCount: 0,
      cacheDriftCount: 0,
    });
  });

  it("flags dealer with non-zero balance and zero ledger as NO_LEDGER", async () => {
    const client = makeDiscoveryStub({
      dealers: [
        {
          dealerCode: "D-001",
          companyName: "Alpha Traders",
          currentBalance: new Prisma.Decimal("1500.00"),
        },
      ],
    });

    const result = await getLedgerBackfillCandidates(client);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      dealerCode: "D-001",
      reason: "NO_LEDGER",
      requiresBackfill: true,
      ledgerEntryCount: 0,
      currentBalance: "1500.00",
    });
  });

  it("flags dealer with invoices only and missing ledger as PARTIAL_LEDGER", async () => {
    const client = makeDiscoveryStub({
      dealers: [
        {
          dealerCode: "D-002",
          companyName: "Beta Distributors",
          currentBalance: new Prisma.Decimal("0.00"),
        },
      ],
      invoices: [{ dealerCode: "D-002", status: "Issued" }],
    });

    const result = await getLedgerBackfillCandidates(client);
    expect(result.candidates[0]).toMatchObject({
      dealerCode: "D-002",
      invoiceCount: 1,
      collectionCount: 0,
      ledgerEntryCount: 0,
      reason: "PARTIAL_LEDGER",
      requiresBackfill: true,
    });
  });

  it("flags dealer with collections only and missing ledger as PARTIAL_LEDGER", async () => {
    const client = makeDiscoveryStub({
      dealers: [
        {
          dealerCode: "D-003",
          companyName: "Gamma Hardware",
          currentBalance: new Prisma.Decimal("0.00"),
        },
      ],
      collections: [{ dealerCode: "D-003", status: "Confirmed" }],
    });

    const result = await getLedgerBackfillCandidates(client);
    expect(result.candidates[0]).toMatchObject({
      dealerCode: "D-003",
      collectionCount: 1,
      invoiceCount: 0,
      ledgerEntryCount: 0,
      reason: "PARTIAL_LEDGER",
      requiresBackfill: true,
    });
  });

  it("flags dealer with partial ledger coverage as PARTIAL_LEDGER", async () => {
    const client = makeDiscoveryStub({
      dealers: [
        {
          dealerCode: "D-004",
          companyName: "Delta Supplies",
          currentBalance: new Prisma.Decimal("500.00"),
        },
      ],
      invoices: [
        { dealerCode: "D-004", status: "Issued" },
        { dealerCode: "D-004", status: "Issued" },
      ],
      ledger: [
        {
          id: "le-1",
          dealerCode: "D-004",
          postingDate: new Date("2026-01-01"),
          debit: new Prisma.Decimal("500.00"),
          credit: new Prisma.Decimal("0.00"),
          balance: new Prisma.Decimal("500.00"),
        },
      ],
    });

    const result = await getLedgerBackfillCandidates(client);
    expect(result.candidates[0]).toMatchObject({
      dealerCode: "D-004",
      invoiceCount: 2,
      ledgerEntryCount: 1,
      reason: "PARTIAL_LEDGER",
      requiresBackfill: true,
    });
  });

  it("marks a fully reconciled dealer as RECONCILED", async () => {
    const client = makeDiscoveryStub({
      dealers: [
        {
          dealerCode: "D-005",
          companyName: "Epsilon Dealers",
          currentBalance: new Prisma.Decimal("750.00"),
        },
      ],
      invoices: [{ dealerCode: "D-005", status: "Issued" }],
      ledger: [
        {
          id: "le-1",
          dealerCode: "D-005",
          postingDate: new Date("2026-01-01"),
          debit: new Prisma.Decimal("750.00"),
          credit: new Prisma.Decimal("0.00"),
          balance: new Prisma.Decimal("750.00"),
        },
      ],
      openingBalances: [{ dealerCode: "D-005", status: "Locked" }],
    });

    const result = await getLedgerBackfillCandidates(client);
    expect(result.candidates[0]).toMatchObject({
      dealerCode: "D-005",
      reason: "RECONCILED",
      requiresBackfill: false,
      openingBalanceExists: true,
      currentBalance: "750.00",
    });
    expect(result.summary.reconciledCount).toBe(1);
  });

  it("classifies cache drift when ledger balance differs from dealer cache", () => {
    const reason = classifyBackfillReason({
      currentBalance: new Prisma.Decimal("1000.00"),
      ledgerEntryCount: 1,
      ledgerBalance: new Prisma.Decimal("900.00"),
      invoiceCount: 1,
      collectionCount: 0,
    });

    expect(reason).toBe("CACHE_DRIFT");
    expect(requiresBackfill(reason)).toBe(true);
  });

  it("maps metrics to transport-safe candidate DTO", () => {
    const candidate = toBackfillCandidate({
      dealerCode: "D-010",
      dealerName: "Zeta Corp",
      currentBalance: new Prisma.Decimal("12.50"),
      ledgerEntryCount: 0,
      ledgerBalance: new Prisma.Decimal("0.00"),
      invoiceCount: 0,
      collectionCount: 0,
      openingBalanceExists: false,
    });

    expect(candidate.currentBalance).toBe("12.50");
    expect(candidate.reason).toBe("NO_LEDGER");
  });
});
