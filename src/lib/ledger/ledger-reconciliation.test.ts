import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import {
  assertDealerLedgerIntegrity,
  assertDealerLedgerReconciled,
  reconcileAllDealers,
  reconcileDealerLedger,
  replayDealerLedgerBalance,
  validateDealerLedgerChain,
} from "@/lib/ledger/ledger-reconciliation";
import { LedgerReconciliationError } from "@/lib/ledger/ledger-errors";

type ReconciliationTx = Parameters<typeof reconcileDealerLedger>[0];

interface StubLedgerRow {
  id: string;
  dealerCode: string;
  postingDate: Date;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  balance: Prisma.Decimal;
}

interface StubDealer {
  dealerCode: string;
  currentBalance: Prisma.Decimal;
}

function makeReconciliationStub(options: {
  dealers: StubDealer[];
  ledger: StubLedgerRow[];
}) {
  const dealers = new Map(
    options.dealers.map((d) => [d.dealerCode, { ...d }] as const),
  );
  const ledger = [...options.ledger];

  const tx = {
    dealer: {
      findUnique: async ({
        where,
        select,
      }: {
        where: { dealerCode: string };
        select: { currentBalance: true };
      }) => {
        const row = dealers.get(where.dealerCode);
        if (!row) return null;
        return { currentBalance: row.currentBalance };
      },
      findMany: async () =>
        [...dealers.values()].map((d) => ({ dealerCode: d.dealerCode })),
    },
    ledgerEntry: {
      findFirst: async ({
        where,
        orderBy,
      }: {
        where: { dealerCode: string };
        orderBy: Array<{ postingDate: "desc" | "asc" } | { id: "desc" | "asc" }>;
      }) => {
        const rows = ledger
          .filter((r) => r.dealerCode === where.dealerCode)
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
      findMany: async ({
        where,
        orderBy,
        select,
      }: {
        where: { dealerCode: string };
        orderBy: Array<{ postingDate: "asc" | "desc" } | { id: "asc" | "desc" }>;
        select: { debit: true; credit: true; balance: true };
      }) => {
        void select;
        return ledger
          .filter((r) => r.dealerCode === where.dealerCode)
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
          })
          .map((r) => ({
            debit: r.debit,
            credit: r.credit,
            balance: r.balance,
          }));
      },
      count: async ({ where }: { where: { dealerCode: string } }) =>
        ledger.filter((r) => r.dealerCode === where.dealerCode).length,
      aggregate: async ({
        where,
        _sum,
      }: {
        where: { dealerCode: string };
        _sum: { debit: true; credit: true };
      }) => {
        void _sum;
        const rows = ledger.filter((r) => r.dealerCode === where.dealerCode);
        return {
          _sum: {
            debit: rows.reduce((acc, r) => acc.plus(r.debit), new Prisma.Decimal(0)),
            credit: rows.reduce((acc, r) => acc.plus(r.credit), new Prisma.Decimal(0)),
          },
        };
      },
    },
  };

  return { tx: tx as unknown as ReconciliationTx, dealers, ledger };
}

describe("reconcileDealerLedger", () => {
  it("reports reconciled when cache and last entry balance match", async () => {
    const { tx } = makeReconciliationStub({
      dealers: [{ dealerCode: "DLR-A", currentBalance: new Prisma.Decimal("700.00") }],
      ledger: [
        {
          id: "e1",
          dealerCode: "DLR-A",
          postingDate: new Date("2026-01-01"),
          debit: new Prisma.Decimal("1000.00"),
          credit: new Prisma.Decimal("0.00"),
          balance: new Prisma.Decimal("1000.00"),
        },
        {
          id: "e2",
          dealerCode: "DLR-A",
          postingDate: new Date("2026-01-02"),
          debit: new Prisma.Decimal("0.00"),
          credit: new Prisma.Decimal("300.00"),
          balance: new Prisma.Decimal("700.00"),
        },
      ],
    });

    const snapshot = await reconcileDealerLedger(tx, "DLR-A");
    expect(snapshot.isReconciled).toBe(true);
    expect(snapshot.entryCount).toBe(2);
    expect(snapshot.drift.toFixed(2)).toBe("0.00");
  });

  it("reports drift when cache diverges from ledger", async () => {
    const { tx } = makeReconciliationStub({
      dealers: [{ dealerCode: "DLR-B", currentBalance: new Prisma.Decimal("999.00") }],
      ledger: [
        {
          id: "e1",
          dealerCode: "DLR-B",
          postingDate: new Date("2026-01-01"),
          debit: new Prisma.Decimal("500.00"),
          credit: new Prisma.Decimal("0.00"),
          balance: new Prisma.Decimal("500.00"),
        },
      ],
    });

    const snapshot = await reconcileDealerLedger(tx, "DLR-B");
    expect(snapshot.isReconciled).toBe(false);
    expect(snapshot.drift.toFixed(2)).toBe("-499.00");
  });
});

describe("assertDealerLedgerReconciled", () => {
  it("allows empty ledger when cache is zero", async () => {
    const { tx } = makeReconciliationStub({
      dealers: [{ dealerCode: "DLR-FRESH", currentBalance: new Prisma.Decimal("0.00") }],
      ledger: [],
    });

    const snapshot = await assertDealerLedgerReconciled(tx, "DLR-FRESH");
    expect(snapshot.entryCount).toBe(0);
    expect(snapshot.isReconciled).toBe(true);
  });

  it("rejects empty ledger with non-zero cache (pre-backfill drift)", async () => {
    const { tx } = makeReconciliationStub({
      dealers: [{ dealerCode: "DLR-LEGACY", currentBalance: new Prisma.Decimal("5000.00") }],
      ledger: [],
    });

    await expect(assertDealerLedgerReconciled(tx, "DLR-LEGACY")).rejects.toBeInstanceOf(
      LedgerReconciliationError,
    );
  });
});

describe("validateDealerLedgerChain", () => {
  it("validates running balance chain and replay invariants", async () => {
    const { tx } = makeReconciliationStub({
      dealers: [{ dealerCode: "DLR-C", currentBalance: new Prisma.Decimal("425.00") }],
      ledger: [
        {
          id: "e1",
          dealerCode: "DLR-C",
          postingDate: new Date("2026-01-01"),
          debit: new Prisma.Decimal("100.00"),
          credit: new Prisma.Decimal("0.00"),
          balance: new Prisma.Decimal("100.00"),
        },
        {
          id: "e2",
          dealerCode: "DLR-C",
          postingDate: new Date("2026-01-02"),
          debit: new Prisma.Decimal("250.00"),
          credit: new Prisma.Decimal("0.00"),
          balance: new Prisma.Decimal("350.00"),
        },
        {
          id: "e3",
          dealerCode: "DLR-C",
          postingDate: new Date("2026-01-03"),
          debit: new Prisma.Decimal("75.00"),
          credit: new Prisma.Decimal("0.00"),
          balance: new Prisma.Decimal("425.00"),
        },
      ],
    });

    const validation = await validateDealerLedgerChain(tx, "DLR-C");
    expect(validation.isChainValid).toBe(true);
    expect(validation.isReplayValid).toBe(true);
    expect(validation.isCacheValid).toBe(true);

    const replay = await replayDealerLedgerBalance(tx, "DLR-C");
    expect(replay.toFixed(2)).toBe("425.00");
    expect(replay.toFixed(2)).toBe(validation.lastEntryBalance.toFixed(2));
  });

  it("detects broken running balance chain", async () => {
    const { tx } = makeReconciliationStub({
      dealers: [{ dealerCode: "DLR-BAD", currentBalance: new Prisma.Decimal("900.00") }],
      ledger: [
        {
          id: "e1",
          dealerCode: "DLR-BAD",
          postingDate: new Date("2026-01-01"),
          debit: new Prisma.Decimal("500.00"),
          credit: new Prisma.Decimal("0.00"),
          balance: new Prisma.Decimal("500.00"),
        },
        {
          id: "e2",
          dealerCode: "DLR-BAD",
          postingDate: new Date("2026-01-02"),
          debit: new Prisma.Decimal("0.00"),
          credit: new Prisma.Decimal("100.00"),
          balance: new Prisma.Decimal("900.00"),
        },
      ],
    });

    const validation = await validateDealerLedgerChain(tx, "DLR-BAD");
    expect(validation.isChainValid).toBe(false);
  });
});

describe("assertDealerLedgerIntegrity", () => {
  it("passes when SUM(debit) − SUM(credit) = last balance = cache", async () => {
    const { tx } = makeReconciliationStub({
      dealers: [{ dealerCode: "DLR-OK", currentBalance: new Prisma.Decimal("700.00") }],
      ledger: [
        {
          id: "e1",
          dealerCode: "DLR-OK",
          postingDate: new Date("2026-01-01"),
          debit: new Prisma.Decimal("1000.00"),
          credit: new Prisma.Decimal("0.00"),
          balance: new Prisma.Decimal("1000.00"),
        },
        {
          id: "e2",
          dealerCode: "DLR-OK",
          postingDate: new Date("2026-01-02"),
          debit: new Prisma.Decimal("0.00"),
          credit: new Prisma.Decimal("300.00"),
          balance: new Prisma.Decimal("700.00"),
        },
      ],
    });

    await expect(assertDealerLedgerIntegrity(tx, "DLR-OK")).resolves.toMatchObject({
      isChainValid: true,
      isReplayValid: true,
      isCacheValid: true,
    });
  });
});

describe("reconcileAllDealers", () => {
  it("certifies every dealer in the repository snapshot", async () => {
    const { tx } = makeReconciliationStub({
      dealers: [
        { dealerCode: "DLR-1", currentBalance: new Prisma.Decimal("0.00") },
        { dealerCode: "DLR-2", currentBalance: new Prisma.Decimal("100.00") },
      ],
      ledger: [
        {
          id: "e1",
          dealerCode: "DLR-2",
          postingDate: new Date("2026-01-01"),
          debit: new Prisma.Decimal("100.00"),
          credit: new Prisma.Decimal("0.00"),
          balance: new Prisma.Decimal("100.00"),
        },
      ],
    });

    const report = await reconcileAllDealers(tx);
    expect(report.dealerCount).toBe(2);
    expect(report.reconciledCount).toBe(2);
    expect(report.unreconciledDealers).toEqual([]);
  });

  it("flags dealers with ledger/cache drift", async () => {
    const { tx } = makeReconciliationStub({
      dealers: [
        { dealerCode: "DLR-GOOD", currentBalance: new Prisma.Decimal("0.00") },
        { dealerCode: "DLR-BAD", currentBalance: new Prisma.Decimal("50.00") },
      ],
      ledger: [],
    });

    const report = await reconcileAllDealers(tx);
    expect(report.reconciledCount).toBe(1);
    expect(report.unreconciledDealers).toEqual(["DLR-BAD"]);
  });
});
