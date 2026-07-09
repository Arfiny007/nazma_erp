import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import {
  classifyReconciliationStatus,
  DealerReconciliationNotFoundError,
  getReconciliationSummary,
  reconcileAllDealers,
  reconcileDealer,
  type ReconciliationReadClient,
} from "@/lib/ledger/reconciliation";

/**
 * Enterprise Reconciliation Engine tests — PHASE_07E3.
 */

const ZERO = new Prisma.Decimal(0);

interface StubDealer {
  dealerCode: string;
  companyName: string;
  currentBalance: Prisma.Decimal;
}

interface StubLedgerRow {
  id: string;
  dealerCode: string;
  postingDate: Date;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  balance: Prisma.Decimal;
}

function makeReconciliationStub(options: {
  dealers?: StubDealer[];
  ledger?: StubLedgerRow[];
}) {
  const dealers = [...(options.dealers ?? [])];
  const ledger = [...(options.ledger ?? [])];

  const client = {
    dealer: {
      findUnique: async ({
        where,
        select,
      }: {
        where: { dealerCode: string };
        select?: { dealerCode?: boolean; companyName?: boolean; currentBalance?: boolean };
      }) => {
        const row = dealers.find((d) => d.dealerCode === where.dealerCode);
        if (!row) return null;
        if (select?.companyName && select?.currentBalance) {
          return {
            dealerCode: row.dealerCode,
            companyName: row.companyName,
            currentBalance: row.currentBalance,
          };
        }
        return { currentBalance: row.currentBalance };
      },
      findMany: async () =>
        dealers.map((d) => ({
          dealerCode: d.dealerCode,
          companyName: d.companyName,
          currentBalance: d.currentBalance,
        })),
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
      }: {
        where: { dealerCode: string };
        orderBy: Array<{ postingDate: "asc" | "desc" } | { id: "asc" | "desc" }>;
      }) => {
        return ledger
          .filter((r) => r.dealerCode === where.dealerCode)
          .sort((a, b) => {
            for (const clause of orderBy) {
              if ("postingDate" in clause) {
                const dir = clause.postingDate === "asc" ? 1 : -1;
                const cmp = a.postingDate.getTime() - b.postingDate.getTime();
                if (cmp !== 0) return cmp * dir;
              }
              if ("id" in clause) {
                const dir = clause.id === "asc" ? 1 : -1;
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
      aggregate: async ({ where }: { where: { dealerCode: string } }) => {
        const rows = ledger.filter((r) => r.dealerCode === where.dealerCode);
        let debit = ZERO;
        let credit = ZERO;
        for (const row of rows) {
          debit = debit.plus(row.debit);
          credit = credit.plus(row.credit);
        }
        return { _sum: { debit, credit } };
      },
    },
  } as unknown as ReconciliationReadClient;

  return { client, ledger };
}

describe("enterprise reconciliation engine — PHASE_07E3", () => {
  it("classifies consistent dealer", async () => {
    const { client } = makeReconciliationStub({
      dealers: [
        {
          dealerCode: "D-OK",
          companyName: "Consistent Dealer",
          currentBalance: new Prisma.Decimal("1000.00"),
        },
      ],
      ledger: [
        {
          id: "le-1",
          dealerCode: "D-OK",
          postingDate: new Date("2026-01-01"),
          debit: new Prisma.Decimal("1000.00"),
          credit: ZERO,
          balance: new Prisma.Decimal("1000.00"),
        },
      ],
    });

    const result = await reconcileDealer("D-OK", client);

    expect(result.status).toBe("CONSISTENT");
    expect(result.drift).toBe("0.00");
    expect(result.latestLedgerBalance).toBe("1000.00");
    expect(result.summedLedgerBalance).toBe("1000.00");
    expect(result.dealerBalance).toBe("1000.00");
  });

  it("classifies drift dealer", async () => {
    const { client } = makeReconciliationStub({
      dealers: [
        {
          dealerCode: "D-DRIFT",
          companyName: "Drift Dealer",
          currentBalance: new Prisma.Decimal("1000.00"),
        },
      ],
      ledger: [
        {
          id: "le-1",
          dealerCode: "D-DRIFT",
          postingDate: new Date("2026-01-01"),
          debit: new Prisma.Decimal("900.00"),
          credit: ZERO,
          balance: new Prisma.Decimal("900.00"),
        },
      ],
    });

    const result = await reconcileDealer("D-DRIFT", client);

    expect(result.status).toBe("DRIFT");
    expect(result.drift).toBe("-100.00");
    expect(result.dealerBalance).toBe("1000.00");
    expect(result.latestLedgerBalance).toBe("900.00");
  });

  it("classifies missing ledger dealer", async () => {
    const { client } = makeReconciliationStub({
      dealers: [
        {
          dealerCode: "D-MISS",
          companyName: "Missing Ledger",
          currentBalance: new Prisma.Decimal("500.00"),
        },
      ],
    });

    const result = await reconcileDealer("D-MISS", client);

    expect(result.status).toBe("MISSING_LEDGER");
    expect(result.ledgerEntryCount).toBe(0);
    expect(result.latestLedgerBalance).toBe("0.00");
  });

  it("classifies corrupted chain dealer", async () => {
    const { client } = makeReconciliationStub({
      dealers: [
        {
          dealerCode: "D-BAD",
          companyName: "Corrupted Chain",
          currentBalance: new Prisma.Decimal("500.00"),
        },
      ],
      ledger: [
        {
          id: "le-1",
          dealerCode: "D-BAD",
          postingDate: new Date("2026-01-01"),
          debit: new Prisma.Decimal("500.00"),
          credit: ZERO,
          balance: new Prisma.Decimal("400.00"),
        },
      ],
    });

    const result = await reconcileDealer("D-BAD", client);

    expect(result.status).toBe("CORRUPTED_CHAIN");
  });

  it("classifies empty dealer as consistent", async () => {
    const { client } = makeReconciliationStub({
      dealers: [
        {
          dealerCode: "D-EMPTY",
          companyName: "Empty Dealer",
          currentBalance: ZERO,
        },
      ],
    });

    const result = await reconcileDealer("D-EMPTY", client);

    expect(result.status).toBe("CONSISTENT");
    expect(result.ledgerEntryCount).toBe(0);
  });

  it("reconciles multiple dealers via reconcileAllDealers", async () => {
    const { client } = makeReconciliationStub({
      dealers: [
        {
          dealerCode: "D-A",
          companyName: "A",
          currentBalance: new Prisma.Decimal("100.00"),
        },
        {
          dealerCode: "D-B",
          companyName: "B",
          currentBalance: new Prisma.Decimal("200.00"),
        },
        {
          dealerCode: "D-C",
          companyName: "C",
          currentBalance: new Prisma.Decimal("50.00"),
        },
      ],
      ledger: [
        {
          id: "le-a",
          dealerCode: "D-A",
          postingDate: new Date("2026-01-01"),
          debit: new Prisma.Decimal("100.00"),
          credit: ZERO,
          balance: new Prisma.Decimal("100.00"),
        },
        {
          id: "le-b",
          dealerCode: "D-B",
          postingDate: new Date("2026-01-01"),
          debit: new Prisma.Decimal("150.00"),
          credit: ZERO,
          balance: new Prisma.Decimal("150.00"),
        },
      ],
    });

    const summary = await reconcileAllDealers(client);

    expect(summary.totalDealers).toBe(3);
    expect(summary.consistentDealers).toBe(1);
    expect(summary.driftedDealers).toBe(1);
    expect(summary.missingLedgerDealers).toBe(1);
    expect(summary.corruptedDealers).toBe(0);
  });

  it("detects ledger sum mismatch as corrupted chain", async () => {
    const status = classifyReconciliationStatus({
      dealerBalance: new Prisma.Decimal("100.00"),
      latestLedgerBalance: new Prisma.Decimal("100.00"),
      summedLedgerBalance: new Prisma.Decimal("90.00"),
      ledgerEntryCount: 2,
      isChainValid: true,
      isReplayValid: false,
      isCacheValid: true,
    });

    expect(status).toBe("CORRUPTED_CHAIN");
  });

  it("detects chain mismatch as corrupted chain", async () => {
    const status = classifyReconciliationStatus({
      dealerBalance: new Prisma.Decimal("100.00"),
      latestLedgerBalance: new Prisma.Decimal("100.00"),
      summedLedgerBalance: new Prisma.Decimal("100.00"),
      ledgerEntryCount: 2,
      isChainValid: false,
      isReplayValid: true,
      isCacheValid: true,
    });

    expect(status).toBe("CORRUPTED_CHAIN");
  });

  it("returns full report from getReconciliationSummary", async () => {
    const { client } = makeReconciliationStub({
      dealers: [
        {
          dealerCode: "D-RPT",
          companyName: "Report Dealer",
          currentBalance: ZERO,
        },
      ],
    });

    const report = await getReconciliationSummary(client);

    expect(report.dealers).toHaveLength(1);
    expect(report.summary.totalDealers).toBe(1);
    expect(report.dealers[0].status).toBe("CONSISTENT");
  });

  it("throws when dealer not found", async () => {
    const { client } = makeReconciliationStub({ dealers: [] });

    await expect(reconcileDealer("D-NONE", client)).rejects.toBeInstanceOf(
      DealerReconciliationNotFoundError,
    );
  });
});
