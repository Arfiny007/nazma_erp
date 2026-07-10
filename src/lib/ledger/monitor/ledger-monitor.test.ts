import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

import {
  reconcileAllDealers,
  type ReconciliationReadClient,
} from "@/lib/ledger/reconciliation";
import {
  getLatestIntegrityScan,
  listIntegrityScans,
  runFinancialIntegrityScan,
  type IntegrityMonitorClient,
} from "@/lib/ledger/monitor";

/**
 * Scheduled Financial Integrity Monitor tests — PHASE_07E4.
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

interface StubScanRow {
  id: string;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  totalDealers: number;
  consistentDealers: number;
  driftedDealers: number;
  missingLedgerDealers: number;
  corruptedDealers: number;
  status: "Completed" | "Failed";
  createdAt: Date;
  updatedAt: Date;
}

function makeMonitorStub(options: {
  dealers?: StubDealer[];
  ledger?: StubLedgerRow[];
  scans?: StubScanRow[];
  reconcileThrows?: boolean;
}) {
  const dealers = [...(options.dealers ?? [])];
  const ledger = [...(options.ledger ?? [])];
  const scans = [...(options.scans ?? [])];

  const reconciliationClient = {
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

  const client = {
    ...reconciliationClient,
    financialIntegrityScan: {
      create: async ({
        data,
      }: {
        data: Omit<StubScanRow, "id" | "createdAt" | "updatedAt">;
      }) => {
        if (options.reconcileThrows) {
          throw new Error("forced persistence after failure");
        }
        const now = new Date(Date.now() + scans.length * 1000);
        const row: StubScanRow = {
          id: `scan-${scans.length + 1}`,
          createdAt: now,
          updatedAt: now,
          ...data,
          startedAt: data.startedAt ?? now,
        };
        scans.push(row);
        return row;
      },
      findFirst: async ({
        orderBy,
      }: {
        orderBy: Array<{ startedAt?: "desc" | "asc"; createdAt?: "desc" | "asc" }>;
      }) => {
        const sorted = [...scans].sort((a, b) => {
          for (const clause of orderBy) {
            if ("startedAt" in clause && clause.startedAt) {
              const dir = clause.startedAt === "desc" ? -1 : 1;
              const cmp = a.startedAt.getTime() - b.startedAt.getTime();
              if (cmp !== 0) return cmp * dir;
            }
            if ("createdAt" in clause && clause.createdAt) {
              const dir = clause.createdAt === "desc" ? -1 : 1;
              const cmp = a.createdAt.getTime() - b.createdAt.getTime();
              if (cmp !== 0) return cmp * dir;
            }
          }
          return 0;
        });
        return sorted[0] ?? null;
      },
      findMany: async ({
        orderBy,
        take,
      }: {
        orderBy: Array<{ startedAt?: "desc" | "asc"; createdAt?: "desc" | "asc" }>;
        take?: number;
      }) => {
        const sorted = [...scans].sort((a, b) => {
          for (const clause of orderBy) {
            if ("startedAt" in clause && clause.startedAt) {
              const dir = clause.startedAt === "desc" ? -1 : 1;
              const cmp = a.startedAt.getTime() - b.startedAt.getTime();
              if (cmp !== 0) return cmp * dir;
            }
            if ("createdAt" in clause && clause.createdAt) {
              const dir = clause.createdAt === "desc" ? -1 : 1;
              const cmp = a.createdAt.getTime() - b.createdAt.getTime();
              if (cmp !== 0) return cmp * dir;
            }
          }
          return 0;
        });
        return typeof take === "number" ? sorted.slice(0, take) : sorted;
      },
    },
  } as unknown as IntegrityMonitorClient;

  return { client, scans };
}

describe("scheduled financial integrity monitor — PHASE_07E4", () => {
  it("runs a successful scan and persists summary", async () => {
    const { client, scans } = makeMonitorStub({
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

    const result = await runFinancialIntegrityScan(client);

    expect(result.totalDealers).toBe(1);
    expect(result.consistentDealers).toBe(1);
    expect(result.driftedDealers).toBe(0);
    expect(result.missingLedgerDealers).toBe(0);
    expect(result.corruptedDealers).toBe(0);
    expect(result.scanId).toBe("scan-1");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(scans).toHaveLength(1);
    expect(scans[0].status).toBe("Completed");
  });

  it("handles empty database", async () => {
    const { client, scans } = makeMonitorStub({ dealers: [] });

    const result = await runFinancialIntegrityScan(client);

    expect(result.totalDealers).toBe(0);
    expect(result.consistentDealers).toBe(0);
    expect(scans).toHaveLength(1);
    expect(scans[0].totalDealers).toBe(0);
  });

  it("detects drift during scan", async () => {
    const { client } = makeMonitorStub({
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

    const result = await runFinancialIntegrityScan(client);

    expect(result.driftedDealers).toBe(1);
    expect(result.consistentDealers).toBe(0);
  });

  it("detects missing ledger during scan", async () => {
    const { client } = makeMonitorStub({
      dealers: [
        {
          dealerCode: "D-MISS",
          companyName: "Missing Ledger",
          currentBalance: new Prisma.Decimal("500.00"),
        },
      ],
    });

    const result = await runFinancialIntegrityScan(client);

    expect(result.missingLedgerDealers).toBe(1);
  });

  it("detects corrupted chain during scan", async () => {
    const { client } = makeMonitorStub({
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

    const result = await runFinancialIntegrityScan(client);

    expect(result.corruptedDealers).toBe(1);
  });

  it("persists only scan summary without dealer detail rows", async () => {
    const { client, scans } = makeMonitorStub({
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
      ],
    });

    await runFinancialIntegrityScan(client);

    expect(scans).toHaveLength(1);
    const persisted = scans[0] as StubScanRow & Record<string, unknown>;
    expect(persisted).not.toHaveProperty("dealers");
    expect(persisted.totalDealers).toBe(2);
    expect(persisted.consistentDealers).toBe(1);
    expect(persisted.missingLedgerDealers).toBe(1);
  });

  it("records multiple scans in history", async () => {
    const { client, scans } = makeMonitorStub({
      dealers: [
        {
          dealerCode: "D-OK",
          companyName: "Consistent Dealer",
          currentBalance: ZERO,
        },
      ],
    });

    await runFinancialIntegrityScan(client);
    await runFinancialIntegrityScan(client);

    expect(scans).toHaveLength(2);
    const history = await listIntegrityScans({}, client);
    expect(history).toHaveLength(2);
    expect(history[0].scanId).toBe("scan-2");
    expect(history[1].scanId).toBe("scan-1");
  });

  it("returns latest scan via getLatestIntegrityScan", async () => {
    const { client } = makeMonitorStub({
      dealers: [
        {
          dealerCode: "D-OK",
          companyName: "Consistent Dealer",
          currentBalance: ZERO,
        },
      ],
    });

    await runFinancialIntegrityScan(client);
    const latest = await getLatestIntegrityScan(client);

    expect(latest).not.toBeNull();
    expect(latest?.scanId).toBe("scan-1");
    expect(latest?.status).toBe("Completed");
  });

  it("reuses reconcileAllDealers without duplicating classification logic", async () => {
    const { client } = makeMonitorStub({
      dealers: [
        {
          dealerCode: "D-OK",
          companyName: "Consistent Dealer",
          currentBalance: new Prisma.Decimal("100.00"),
        },
      ],
      ledger: [
        {
          id: "le-1",
          dealerCode: "D-OK",
          postingDate: new Date("2026-01-01"),
          debit: new Prisma.Decimal("100.00"),
          credit: ZERO,
          balance: new Prisma.Decimal("100.00"),
        },
      ],
    });

    const reconcileSpy = vi.spyOn(
      await import("@/lib/ledger/reconciliation"),
      "reconcileAllDealers",
    );

    await runFinancialIntegrityScan(client);

    expect(reconcileSpy).toHaveBeenCalledTimes(1);
    reconcileSpy.mockRestore();
  });

  it("persists failed scan when reconciliation throws", async () => {
    const { client, scans } = makeMonitorStub({ dealers: [] });
    const reconcileSpy = vi
      .spyOn(await import("@/lib/ledger/reconciliation"), "reconcileAllDealers")
      .mockRejectedValueOnce(new Error("reconciliation failed"));

    await expect(runFinancialIntegrityScan(client)).rejects.toThrow(
      "reconciliation failed",
    );

    expect(scans).toHaveLength(1);
    expect(scans[0].status).toBe("Failed");
    expect(scans[0].totalDealers).toBe(0);

    reconcileSpy.mockRestore();
  });
});

describe("reconcileAllDealers reuse guard", () => {
  it("summary from reconcileAllDealers matches scan counts", async () => {
    const { client } = makeMonitorStub({
      dealers: [
        {
          dealerCode: "D-A",
          companyName: "A",
          currentBalance: new Prisma.Decimal("100.00"),
        },
        {
          dealerCode: "D-B",
          companyName: "B",
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
      ],
    });

    const summary = await reconcileAllDealers(client);
    const scan = await runFinancialIntegrityScan(client);

    expect(scan.totalDealers).toBe(summary.totalDealers);
    expect(scan.missingLedgerDealers).toBe(summary.missingLedgerDealers);
  });
});
