import { describe, expect, it } from "vitest";
import {
  FinancialReferenceType,
  LedgerPostingType,
  Prisma,
} from "@prisma/client";

import {
  LedgerReplayChainCorruptedError,
  LedgerReplayNotEligibleError,
  LedgerReplayParityError,
  replayDealerLedger,
  sortReplayEvents,
  type ReplayReadClient,
} from "@/lib/ledger/backfill";
import { buildLedgerPostingKey } from "@/lib/ledger/posting-key";
import {
  assertLedgerBalanceMatchesCache,
  createLedgerEntry,
} from "@/lib/ledger";

/**
 * Comprehensive replay engine tests — PHASE_07E2.
 */

const ZERO = new Prisma.Decimal(0);

interface StubDealer {
  dealerCode: string;
  companyName: string;
  currentBalance: Prisma.Decimal;
}

interface StubInvoice {
  id: string;
  dealerCode: string;
  invoiceNo: string;
  grandTotal: Prisma.Decimal;
  issueDate: Date;
  createdAt: Date;
  status: string;
}

interface StubCollection {
  id: string;
  dealerCode: string;
  collectionNo: string;
  receivedAmount: Prisma.Decimal;
  collectionDate: Date;
  confirmedAt: Date | null;
  createdAt: Date;
  status: string;
  reversedAt: Date | null;
  confirmedById: string | null;
  remarks: string | null;
}

interface StubOpeningBalance {
  dealerCode: string;
  amount: Prisma.Decimal;
  effectiveDate: Date;
  referenceNo: string | null;
  createdById: string;
  status: string;
}

interface StubLedgerRow {
  id: string;
  dealerCode: string;
  transactionDate: Date;
  postingDate: Date;
  referenceType: FinancialReferenceType;
  referenceId: string;
  referenceNo: string;
  postingType: LedgerPostingType;
  postingKey: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  balance: Prisma.Decimal;
  reversesEntryId: string | null;
  createdById: string | null;
  remarks: string | null;
}

function toDecimal(value: unknown): Prisma.Decimal {
  if (Prisma.Decimal.isDecimal(value)) return value;
  if (typeof value === "string" || typeof value === "number") {
    return new Prisma.Decimal(value);
  }
  throw new Error(`Unsupported Decimal: ${String(value)}`);
}

function makeReplayStub(options: {
  dealers?: StubDealer[];
  invoices?: StubInvoice[];
  collections?: StubCollection[];
  openingBalances?: StubOpeningBalance[];
  ledger?: StubLedgerRow[];
}) {
  const dealers = [...(options.dealers ?? [])];
  const invoices = [...(options.invoices ?? [])];
  const collections = [...(options.collections ?? [])];
  const openingBalances = [...(options.openingBalances ?? [])];
  const ledger: StubLedgerRow[] = [...(options.ledger ?? [])];
  let idCounter = ledger.length;

  const tx = {
    dealer: {
      findUnique: async ({ where }: { where: { dealerCode: string } }) => {
        const d = dealers.find((x) => x.dealerCode === where.dealerCode);
        if (!d) return null;
        return {
          dealerCode: d.dealerCode,
          companyName: d.companyName,
          currentBalance: d.currentBalance,
        };
      },
      findMany: async () =>
        dealers.map((d) => ({
          dealerCode: d.dealerCode,
          companyName: d.companyName,
          currentBalance: d.currentBalance,
        })),
      update: async () => {
        throw new Error("Replay must not mutate dealer balance");
      },
    },
    invoice: {
      findMany: async ({
        where,
      }: {
        where: {
          dealerCode: string;
          status?: { in?: string[] };
        };
      }) => {
        const allowed = new Set(where.status?.in ?? []);
        return invoices
          .filter(
            (i) =>
              i.dealerCode === where.dealerCode &&
              (allowed.size === 0 || allowed.has(i.status)),
          )
          .map((i) => ({
            id: i.id,
            invoiceNo: i.invoiceNo,
            grandTotal: i.grandTotal,
            issueDate: i.issueDate,
            createdAt: i.createdAt,
          }));
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const i = invoices.find((x) => x.id === where.id);
        return i ? { dealerCode: i.dealerCode } : null;
      },
      groupBy: async ({
        where,
      }: {
        where?: { status?: { in?: string[] } };
      }) => {
        const allowed = new Set(where?.status?.in ?? []);
        const counts = new Map<string, number>();
        for (const inv of invoices) {
          if (allowed.size > 0 && !allowed.has(inv.status)) continue;
          counts.set(inv.dealerCode, (counts.get(inv.dealerCode) ?? 0) + 1);
        }
        return [...counts.entries()].map(([dealerCode, count]) => ({
          dealerCode,
          _count: { _all: count },
        }));
      },
    },
    collection: {
      findMany: async ({
        where,
      }: {
        where: {
          dealerCode: string;
          OR?: Array<{ status: { in?: string[] } } | { status: string }>;
        };
      }) => {
        const statuses = new Set<string>();
        for (const clause of where.OR ?? []) {
          if ("status" in clause) {
            if (typeof clause.status === "string") {
              statuses.add(clause.status);
            } else if (clause.status.in) {
              clause.status.in.forEach((s) => statuses.add(s));
            }
          }
        }
        return collections
          .filter(
            (c) =>
              c.dealerCode === where.dealerCode &&
              (statuses.size === 0 || statuses.has(c.status)),
          )
          .map((c) => ({
            id: c.id,
            collectionNo: c.collectionNo,
            receivedAmount: c.receivedAmount,
            collectionDate: c.collectionDate,
            confirmedAt: c.confirmedAt,
            createdAt: c.createdAt,
            status: c.status,
            reversedAt: c.reversedAt,
            confirmedById: c.confirmedById,
            remarks: c.remarks,
          }));
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const c = collections.find((x) => x.id === where.id);
        return c ? { dealerCode: c.dealerCode } : null;
      },
      groupBy: async ({
        where,
      }: {
        where?: { status?: { in?: string[] } };
      }) => {
        const allowed = new Set(where?.status?.in ?? []);
        const counts = new Map<string, number>();
        for (const col of collections) {
          if (allowed.size > 0 && !allowed.has(col.status)) continue;
          counts.set(col.dealerCode, (counts.get(col.dealerCode) ?? 0) + 1);
        }
        return [...counts.entries()].map(([dealerCode, count]) => ({
          dealerCode,
          _count: { _all: count },
        }));
      },
    },
    openingBalance: {
      findUnique: async ({ where }: { where: { dealerCode: string } }) => {
        const ob = openingBalances.find(
          (x) => x.dealerCode === where.dealerCode,
        );
        if (!ob) return null;
        return {
          id: `ob-${ob.dealerCode}`,
          amount: ob.amount,
          effectiveDate: ob.effectiveDate,
          referenceNo: ob.referenceNo,
          createdById: ob.createdById,
          status: ob.status,
        };
      },
      findMany: async ({
        where,
      }: {
        where?: { status?: { in?: string[] } };
      }) => {
        const allowed = new Set(where?.status?.in ?? []);
        return openingBalances
          .filter((ob) => allowed.size === 0 || allowed.has(ob.status))
          .map((ob) => ({ dealerCode: ob.dealerCode }));
      },
    },
    ledgerEntry: {
      create: async (args: { data: StubLedgerRow }) => {
        if (ledger.some((r) => r.postingKey === args.data.postingKey)) {
          throw new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            {
              code: "P2002",
              clientVersion: "test",
              meta: { target: ["postingKey"] },
            },
          );
        }
        idCounter += 1;
        const row: StubLedgerRow = {
          ...args.data,
          id: `le-${idCounter}`,
          postingDate: new Date(),
          debit: toDecimal(args.data.debit),
          credit: toDecimal(args.data.credit),
          balance: toDecimal(args.data.balance),
          reversesEntryId: args.data.reversesEntryId ?? null,
          createdById: args.data.createdById ?? null,
          remarks: args.data.remarks ?? null,
        };
        ledger.push(row);
        return row;
      },
      findUnique: async (args: { where: { postingKey: string } }) => {
        return ledger.find((r) => r.postingKey === args.where.postingKey) ?? null;
      },
      findFirst: async ({
        where,
        orderBy,
      }: {
        where: { dealerCode: string };
        orderBy: Array<
          { postingDate: "asc" | "desc" } | { id: "asc" | "desc" }
        >;
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
        where: { dealerCode?: string; postingKey?: { in?: string[] } };
        orderBy?: Array<
          { postingDate: "asc" | "desc" } | { id: "asc" | "desc" }
        >;
        select?: {
          postingKey?: boolean;
          balance?: boolean;
          debit?: boolean;
          credit?: boolean;
        };
      }) => {
        let rows = [...ledger];
        if (where.dealerCode) {
          rows = rows.filter((r) => r.dealerCode === where.dealerCode);
        }
        if (where.postingKey?.in) {
          const keys = new Set(where.postingKey.in);
          rows = rows.filter((r) => keys.has(r.postingKey));
        }
        if (orderBy) {
          rows.sort((a, b) => {
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
        }
        if (select?.postingKey && !select.balance) {
          return rows.map((r) => ({ postingKey: r.postingKey }));
        }
        if (select?.balance && !select.debit) {
          return rows.map((r) => ({ balance: r.balance }));
        }
        if (select?.debit) {
          return rows.map((r) => ({
            debit: r.debit,
            credit: r.credit,
            balance: r.balance,
          }));
        }
        return rows;
      },
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
    $queryRaw: async () => {
      throw new Error("$queryRaw not implemented in stub");
    },
  } as unknown as ReplayReadClient;

  return { client: tx, ledger, dealers };
}

describe("ledger backfill replay — PHASE_07E2", () => {
  it("replays dealer with invoices only", async () => {
    const { client, ledger } = makeReplayStub({
      dealers: [
        {
          dealerCode: "D-INV",
          companyName: "Invoice Dealer",
          currentBalance: new Prisma.Decimal("1500.00"),
        },
      ],
      invoices: [
        {
          id: "inv-1",
          dealerCode: "D-INV",
          invoiceNo: "INV-001",
          grandTotal: new Prisma.Decimal("1000.00"),
          issueDate: new Date("2026-01-10"),
          createdAt: new Date("2026-01-10"),
          status: "Issued",
        },
        {
          id: "inv-2",
          dealerCode: "D-INV",
          invoiceNo: "INV-002",
          grandTotal: new Prisma.Decimal("500.00"),
          issueDate: new Date("2026-01-15"),
          createdAt: new Date("2026-01-15"),
          status: "Issued",
        },
      ],
    });

    const result = await replayDealerLedger(client, "D-INV");

    expect(result.success).toBe(true);
    expect(result.createdEntries).toBe(2);
    expect(result.invoiceEntries).toBe(2);
    expect(result.finalLedgerBalance).toBe("1500.00");
    expect(ledger).toHaveLength(2);
    expect(ledger[1].balance.toFixed(2)).toBe("1500.00");
  });

  it("replays dealer with collections only", async () => {
    const { client, ledger } = makeReplayStub({
      dealers: [
        {
          dealerCode: "D-COL",
          companyName: "Collection Dealer",
          currentBalance: new Prisma.Decimal("-200.00"),
        },
      ],
      collections: [
        {
          id: "col-1",
          dealerCode: "D-COL",
          collectionNo: "COL-001",
          receivedAmount: new Prisma.Decimal("200.00"),
          collectionDate: new Date("2026-02-01"),
          confirmedAt: new Date("2026-02-01"),
          createdAt: new Date("2026-02-01"),
          status: "Confirmed",
          reversedAt: null,
          confirmedById: "user-1",
          remarks: null,
        },
      ],
    });

    const result = await replayDealerLedger(client, "D-COL");

    expect(result.success).toBe(true);
    expect(result.collectionEntries).toBe(1);
    expect(result.finalLedgerBalance).toBe("-200.00");
    expect(ledger[0].credit.toFixed(2)).toBe("200.00");
  });

  it("replays dealer with opening balance", async () => {
    const { client, ledger } = makeReplayStub({
      dealers: [
        {
          dealerCode: "D-OB",
          companyName: "OB Dealer",
          currentBalance: new Prisma.Decimal("3000.00"),
        },
      ],
      openingBalances: [
        {
          dealerCode: "D-OB",
          amount: new Prisma.Decimal("3000.00"),
          effectiveDate: new Date("2026-01-01"),
          referenceNo: "OB-D-OB",
          createdById: "user-1",
          status: "Locked",
        },
      ],
    });

    const result = await replayDealerLedger(client, "D-OB");

    expect(result.success).toBe(true);
    expect(result.openingBalanceEntries).toBe(1);
    expect(result.finalLedgerBalance).toBe("3000.00");
    expect(ledger[0].postingType).toBe(LedgerPostingType.OpeningBalance);
  });

  it("replays dealer with collection reversals", async () => {
    const { client, ledger } = makeReplayStub({
      dealers: [
        {
          dealerCode: "D-REV",
          companyName: "Reversal Dealer",
          currentBalance: new Prisma.Decimal("0.00"),
        },
      ],
      collections: [
        {
          id: "col-rev",
          dealerCode: "D-REV",
          collectionNo: "COL-REV",
          receivedAmount: new Prisma.Decimal("500.00"),
          collectionDate: new Date("2026-03-01"),
          confirmedAt: new Date("2026-03-01"),
          createdAt: new Date("2026-03-01"),
          status: "Reversed",
          reversedAt: new Date("2026-03-05"),
          confirmedById: "user-1",
          remarks: null,
        },
      ],
    });

    const result = await replayDealerLedger(client, "D-REV");

    expect(result.success).toBe(true);
    expect(result.collectionEntries).toBe(1);
    expect(result.reversalEntries).toBe(1);
    expect(result.createdEntries).toBe(2);
    expect(ledger).toHaveLength(2);
    expect(ledger[1].postingType).toBe(LedgerPostingType.Reversal);
    expect(ledger[1].balance.toFixed(2)).toBe("0.00");
    expect(ledger[1].reversesEntryId).toBe(ledger[0].id);
  });

  it("is idempotent on duplicate replay", async () => {
    const { client } = makeReplayStub({
      dealers: [
        {
          dealerCode: "D-DUP",
          companyName: "Dup Dealer",
          currentBalance: new Prisma.Decimal("1000.00"),
        },
      ],
      invoices: [
        {
          id: "inv-dup",
          dealerCode: "D-DUP",
          invoiceNo: "INV-DUP",
          grandTotal: new Prisma.Decimal("1000.00"),
          issueDate: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          status: "Issued",
        },
      ],
    });

    const first = await replayDealerLedger(client, "D-DUP");
    const second = await replayDealerLedger(client, "D-DUP");

    expect(first.createdEntries).toBe(1);
    expect(second.createdEntries).toBe(0);
    expect(second.skippedEntries).toBe(1);
    expect(second.success).toBe(true);
  });

  it("supports partial replay when some entries already exist", async () => {
    const postingKey = buildLedgerPostingKey({
      referenceType: FinancialReferenceType.Invoice,
      referenceId: "inv-partial-1",
      postingType: LedgerPostingType.Issue,
    });

    const { client, ledger } = makeReplayStub({
      dealers: [
        {
          dealerCode: "D-PART",
          companyName: "Partial Dealer",
          currentBalance: new Prisma.Decimal("1500.00"),
        },
      ],
      invoices: [
        {
          id: "inv-partial-1",
          dealerCode: "D-PART",
          invoiceNo: "INV-P1",
          grandTotal: new Prisma.Decimal("1000.00"),
          issueDate: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          status: "Issued",
        },
        {
          id: "inv-partial-2",
          dealerCode: "D-PART",
          invoiceNo: "INV-P2",
          grandTotal: new Prisma.Decimal("500.00"),
          issueDate: new Date("2026-01-10"),
          createdAt: new Date("2026-01-10"),
          status: "Issued",
        },
      ],
      ledger: [
        {
          id: "le-existing",
          dealerCode: "D-PART",
          transactionDate: new Date("2026-01-01"),
          postingDate: new Date("2026-01-01"),
          referenceType: FinancialReferenceType.Invoice,
          referenceId: "inv-partial-1",
          referenceNo: "INV-P1",
          postingType: LedgerPostingType.Issue,
          postingKey,
          debit: new Prisma.Decimal("1000.00"),
          credit: ZERO,
          balance: new Prisma.Decimal("1000.00"),
          reversesEntryId: null,
          createdById: null,
          remarks: null,
        },
      ],
    });

    const result = await replayDealerLedger(client, "D-PART");

    expect(result.createdEntries).toBe(1);
    expect(result.skippedEntries).toBe(1);
    expect(result.invoiceEntries).toBe(1);
    expect(ledger).toHaveLength(2);
    expect(ledger[1].balance.toFixed(2)).toBe("1500.00");
  });

  it("preserves chronological replay order", async () => {
    const { client, ledger } = makeReplayStub({
      dealers: [
        {
          dealerCode: "D-ORD",
          companyName: "Order Dealer",
          currentBalance: new Prisma.Decimal("500.00"),
        },
      ],
      invoices: [
        {
          id: "inv-late",
          dealerCode: "D-ORD",
          invoiceNo: "INV-LATE",
          grandTotal: new Prisma.Decimal("500.00"),
          issueDate: new Date("2026-02-01"),
          createdAt: new Date("2026-02-01"),
          status: "Issued",
        },
      ],
      openingBalances: [
        {
          dealerCode: "D-ORD",
          amount: new Prisma.Decimal("1000.00"),
          effectiveDate: new Date("2026-03-01"),
          referenceNo: "OB-D-ORD",
          createdById: "user-1",
          status: "Locked",
        },
      ],
      collections: [
        {
          id: "col-early",
          dealerCode: "D-ORD",
          collectionNo: "COL-EARLY",
          receivedAmount: new Prisma.Decimal("1000.00"),
          collectionDate: new Date("2026-01-15"),
          confirmedAt: new Date("2026-01-15"),
          createdAt: new Date("2026-01-15"),
          status: "Confirmed",
          reversedAt: null,
          confirmedById: "user-1",
          remarks: null,
        },
      ],
    });

    await replayDealerLedger(client, "D-ORD");

    expect(ledger[0].postingType).toBe(LedgerPostingType.OpeningBalance);
    expect(ledger[1].postingType).toBe(LedgerPostingType.Issue);
    expect(ledger[2].postingType).toBe(LedgerPostingType.Collection);
    expect(ledger[ledger.length - 1].balance.toFixed(2)).toBe("500.00");
  });

  it("allows idempotent no-op for reconciled dealer", async () => {
    const postingKey = buildLedgerPostingKey({
      referenceType: FinancialReferenceType.Invoice,
      referenceId: "inv-rec",
      postingType: LedgerPostingType.Issue,
    });

    const { client } = makeReplayStub({
      dealers: [
        {
          dealerCode: "D-REC",
          companyName: "Reconciled",
          currentBalance: new Prisma.Decimal("1000.00"),
        },
      ],
      invoices: [
        {
          id: "inv-rec",
          dealerCode: "D-REC",
          invoiceNo: "INV-REC",
          grandTotal: new Prisma.Decimal("1000.00"),
          issueDate: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          status: "Issued",
        },
      ],
      ledger: [
        {
          id: "le-rec",
          dealerCode: "D-REC",
          transactionDate: new Date("2026-01-01"),
          postingDate: new Date("2026-01-01"),
          referenceType: FinancialReferenceType.Invoice,
          referenceId: "inv-rec",
          referenceNo: "INV-REC",
          postingType: LedgerPostingType.Issue,
          postingKey,
          debit: new Prisma.Decimal("1000.00"),
          credit: ZERO,
          balance: new Prisma.Decimal("1000.00"),
          reversesEntryId: null,
          createdById: null,
          remarks: null,
        },
      ],
    });

    const result = await replayDealerLedger(client, "D-REC");

    expect(result.success).toBe(true);
    expect(result.createdEntries).toBe(0);
    expect(result.skippedEntries).toBe(1);
  });

  it("rejects cache drift dealer", async () => {
    const postingKey = buildLedgerPostingKey({
      referenceType: FinancialReferenceType.Invoice,
      referenceId: "inv-drift",
      postingType: LedgerPostingType.Issue,
    });

    const { client } = makeReplayStub({
      dealers: [
        {
          dealerCode: "D-DRIFT",
          companyName: "Drift",
          currentBalance: new Prisma.Decimal("1000.00"),
        },
      ],
      invoices: [
        {
          id: "inv-drift",
          dealerCode: "D-DRIFT",
          invoiceNo: "INV-DRIFT",
          grandTotal: new Prisma.Decimal("1000.00"),
          issueDate: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          status: "Issued",
        },
      ],
      ledger: [
        {
          id: "le-drift",
          dealerCode: "D-DRIFT",
          transactionDate: new Date("2026-01-01"),
          postingDate: new Date("2026-01-01"),
          referenceType: FinancialReferenceType.Invoice,
          referenceId: "inv-drift",
          referenceNo: "INV-DRIFT",
          postingType: LedgerPostingType.Issue,
          postingKey,
          debit: new Prisma.Decimal("900.00"),
          credit: ZERO,
          balance: new Prisma.Decimal("900.00"),
          reversesEntryId: null,
          createdById: null,
          remarks: null,
        },
      ],
    });

    await expect(replayDealerLedger(client, "D-DRIFT")).rejects.toBeInstanceOf(
      LedgerReplayNotEligibleError,
    );
  });

  it("rolls back on parity failure", async () => {
    const { client } = makeReplayStub({
      dealers: [
        {
          dealerCode: "D-PARITY",
          companyName: "Parity Fail",
          currentBalance: new Prisma.Decimal("999.00"),
        },
      ],
      invoices: [
        {
          id: "inv-parity",
          dealerCode: "D-PARITY",
          invoiceNo: "INV-PARITY",
          grandTotal: new Prisma.Decimal("1000.00"),
          issueDate: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          status: "Issued",
        },
      ],
    });

    await expect(replayDealerLedger(client, "D-PARITY")).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof LedgerReplayParityError ||
        (error instanceof Error &&
          error.name === "LedgerBalanceMismatchError"),
    );
  });

  it("rejects corrupted ledger chain", async () => {
    const postingKey = buildLedgerPostingKey({
      referenceType: FinancialReferenceType.Invoice,
      referenceId: "inv-bad",
      postingType: LedgerPostingType.Issue,
    });

    const { client } = makeReplayStub({
      dealers: [
        {
          dealerCode: "D-BAD",
          companyName: "Bad Chain",
          currentBalance: new Prisma.Decimal("500.00"),
        },
      ],
      invoices: [
        {
          id: "inv-bad",
          dealerCode: "D-BAD",
          invoiceNo: "INV-BAD",
          grandTotal: new Prisma.Decimal("500.00"),
          issueDate: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          status: "Issued",
        },
        {
          id: "inv-missing",
          dealerCode: "D-BAD",
          invoiceNo: "INV-MISS",
          grandTotal: new Prisma.Decimal("200.00"),
          issueDate: new Date("2026-01-05"),
          createdAt: new Date("2026-01-05"),
          status: "Issued",
        },
      ],
      ledger: [
        {
          id: "le-bad",
          dealerCode: "D-BAD",
          transactionDate: new Date("2026-01-01"),
          postingDate: new Date("2026-01-01"),
          referenceType: FinancialReferenceType.Invoice,
          referenceId: "inv-bad",
          referenceNo: "INV-BAD",
          postingType: LedgerPostingType.Issue,
          postingKey,
          debit: new Prisma.Decimal("500.00"),
          credit: ZERO,
          balance: new Prisma.Decimal("400.00"),
          reversesEntryId: null,
          createdById: null,
          remarks: null,
        },
      ],
    });

    await expect(replayDealerLedger(client, "D-BAD")).rejects.toBeInstanceOf(
      LedgerReplayChainCorruptedError,
    );
  });

  it("sortReplayEvents orders by phase then date", () => {
    const events = sortReplayEvents([
      {
        eventType: "Collection",
        phase: 2,
        transactionDate: new Date("2026-01-15"),
        postingDate: new Date("2026-01-15"),
        createdAt: new Date("2026-01-15"),
        referenceType: FinancialReferenceType.Collection,
        referenceId: "c1",
        referenceNo: "COL-1",
        postingType: LedgerPostingType.Collection,
        postingKey: "k-col",
        debit: ZERO,
        credit: new Prisma.Decimal("100"),
        createdById: null,
        remarks: null,
        reversesCollectionId: null,
      },
      {
        eventType: "OpeningBalance",
        phase: 0,
        transactionDate: new Date("2026-03-01"),
        postingDate: new Date("2026-03-01"),
        createdAt: new Date("2026-03-01"),
        referenceType: FinancialReferenceType.OpeningBalance,
        referenceId: "OB-D",
        referenceNo: "OB-D",
        postingType: LedgerPostingType.OpeningBalance,
        postingKey: "k-ob",
        debit: new Prisma.Decimal("1000"),
        credit: ZERO,
        createdById: null,
        remarks: null,
        reversesCollectionId: null,
      },
      {
        eventType: "Invoice",
        phase: 1,
        transactionDate: new Date("2026-02-01"),
        postingDate: new Date("2026-02-01"),
        createdAt: new Date("2026-02-01"),
        referenceType: FinancialReferenceType.Invoice,
        referenceId: "i1",
        referenceNo: "INV-1",
        postingType: LedgerPostingType.Issue,
        postingKey: "k-inv",
        debit: new Prisma.Decimal("500"),
        credit: ZERO,
        createdById: null,
        remarks: null,
        reversesCollectionId: null,
      },
    ]);

    expect(events[0].eventType).toBe("OpeningBalance");
    expect(events[1].eventType).toBe("Invoice");
    expect(events[2].eventType).toBe("Collection");
  });

  it("uses createLedgerEntry for posting", async () => {
    const { client, ledger } = makeReplayStub({
      dealers: [
        {
          dealerCode: "D-CL",
          companyName: "CL",
          currentBalance: new Prisma.Decimal("100.00"),
        },
      ],
      invoices: [
        {
          id: "inv-cl",
          dealerCode: "D-CL",
          invoiceNo: "INV-CL",
          grandTotal: new Prisma.Decimal("100.00"),
          issueDate: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          status: "Issued",
        },
      ],
    });

    await replayDealerLedger(client, "D-CL");
    expect(ledger).toHaveLength(1);
    expect(ledger[0].postingKey).toContain("Invoice");
  });
});

describe("createLedgerEntry idempotency in replay context", () => {
  it("collapses duplicate postingKey on retry", async () => {
    const { client } = makeReplayStub({ dealers: [] });
    const input = {
      tx: client as Parameters<typeof createLedgerEntry>[0]["tx"],
      dealerCode: "D-TEST",
      transactionDate: new Date("2026-01-01"),
      referenceType: FinancialReferenceType.Invoice,
      referenceId: "inv-test",
      referenceNo: "INV-TEST",
      postingType: LedgerPostingType.Issue,
      debit: new Prisma.Decimal("100.00"),
      credit: ZERO,
      previousBalance: ZERO,
    };

    const first = await createLedgerEntry(input);
    const second = await createLedgerEntry(input);

    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
    expect(first.id).toBe(second.id);
  });

  it("assertLedgerBalanceMatchesCache throws on drift", () => {
    expect(() =>
      assertLedgerBalanceMatchesCache(
        "D-TEST",
        new Prisma.Decimal("100.00"),
        new Prisma.Decimal("99.00"),
      ),
    ).toThrow();
  });
});
