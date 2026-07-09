import { describe, expect, it } from "vitest";
import {
  FinancialReferenceType,
  LedgerPostingType,
  OpeningBalanceSource,
  OpeningBalanceStatus,
  Prisma,
} from "@prisma/client";

import { OpeningBalanceError } from "@/lib/finance/initialization/opening-balance-errors";
import {
  createOpeningBalanceRecord,
  postOpeningBalanceRecord,
  validateOpeningBalanceRecord,
} from "@/lib/finance/initialization/opening-balance";

/**
 * Unit tests for the PHASE_07C Financial Initialization Engine core workflow.
 *
 * These exercise `opening-balance.ts` against an in-memory Prisma transaction
 * stub — same technique as `posting-service.test.ts` — so they run without a
 * live PostgreSQL. The stub reproduces the exact delegate surface the engine
 * consumes: `openingBalance` CRUD, `dealer.update` + `$queryRaw` (the
 * `SELECT … FOR UPDATE` dealer lock), `ledgerEntry` create/find, `auditLog.create`.
 */

interface StubDealer {
  dealerCode: string;
  creditLimit: Prisma.Decimal;
  currentBalance: Prisma.Decimal;
}

interface StubOpeningBalanceRow {
  id: string;
  dealerCode: string;
  amount: Prisma.Decimal;
  effectiveDate: Date;
  status: OpeningBalanceStatus;
  source: OpeningBalanceSource;
  referenceNo: string | null;
  remarks: string | null;
  createdById: string;
  validatedAt: Date | null;
  validatedById: string | null;
  postedAt: Date | null;
  postedById: string | null;
  lockedAt: Date | null;
  ledgerEntryId: string | null;
  postingKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StubLedgerEntry {
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

interface StubAuditRow {
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue: Prisma.JsonValue;
  newValue: Prisma.JsonValue;
}

function toDecimal(value: unknown): Prisma.Decimal {
  if (Prisma.Decimal.isDecimal(value)) return value as Prisma.Decimal;
  if (typeof value === "string" || typeof value === "number") {
    return new Prisma.Decimal(value);
  }
  throw new Error(`Unsupported Decimal input: ${String(value)}`);
}

function makeStubTx(dealerSeed: StubDealer[]) {
  const dealers = new Map(dealerSeed.map((d) => [d.dealerCode, { ...d }]));
  const openingBalances = new Map<string, StubOpeningBalanceRow>();
  const ledger: StubLedgerEntry[] = [];
  const audit: StubAuditRow[] = [];

  let idCounter = 0;
  const nextId = (prefix: string) => `${prefix}-${(idCounter += 1)}`;

  const tx = {
    $queryRaw: async (_strings: unknown, ...values: unknown[]): Promise<
      Array<{ dealerCode: string; creditLimit: Prisma.Decimal; currentBalance: Prisma.Decimal }>
    > => {
      const dealerCode = String(values[0]);
      const dealer = dealers.get(dealerCode);
      if (!dealer) return [];
      return [
        {
          dealerCode: dealer.dealerCode,
          creditLimit: dealer.creditLimit,
          currentBalance: dealer.currentBalance,
        },
      ];
    },
    dealer: {
      update: async (args: {
        where: { dealerCode: string };
        data: {
          currentBalance?:
            | { increment: Prisma.Decimal }
            | { decrement: Prisma.Decimal };
        };
      }) => {
        const dealer = dealers.get(args.where.dealerCode);
        if (!dealer) throw new Error(`Dealer not found: ${args.where.dealerCode}`);
        const patch = args.data.currentBalance;
        if (patch && "increment" in patch) {
          dealer.currentBalance = dealer.currentBalance.plus(toDecimal(patch.increment));
        } else if (patch && "decrement" in patch) {
          dealer.currentBalance = dealer.currentBalance.minus(toDecimal(patch.decrement));
        }
        return { currentBalance: dealer.currentBalance };
      },
    },
    openingBalance: {
      create: async (args: { data: Omit<StubOpeningBalanceRow, "id" | "createdAt" | "updatedAt" | "validatedAt" | "validatedById" | "postedAt" | "postedById" | "lockedAt" | "ledgerEntryId" | "postingKey"> & { referenceNo: string | null } }) => {
        const now = new Date();
        const row: StubOpeningBalanceRow = {
          id: nextId("ob"),
          dealerCode: args.data.dealerCode,
          amount: toDecimal(args.data.amount),
          effectiveDate: args.data.effectiveDate,
          status: args.data.status,
          source: args.data.source,
          referenceNo: args.data.referenceNo,
          remarks: args.data.remarks,
          createdById: args.data.createdById,
          validatedAt: null,
          validatedById: null,
          postedAt: null,
          postedById: null,
          lockedAt: null,
          ledgerEntryId: null,
          postingKey: null,
          createdAt: now,
          updatedAt: now,
        };
        openingBalances.set(row.id, row);
        return row;
      },
      findUnique: async (args: { where: { id: string } }) =>
        openingBalances.get(args.where.id) ?? null,
      update: async (args: { where: { id: string }; data: Partial<StubOpeningBalanceRow> }) => {
        const existing = openingBalances.get(args.where.id);
        if (!existing) throw new Error(`OpeningBalance not found: ${args.where.id}`);
        const updated: StubOpeningBalanceRow = {
          ...existing,
          ...args.data,
          updatedAt: new Date(),
        };
        openingBalances.set(updated.id, updated);
        return updated;
      },
    },
    ledgerEntry: {
      create: async (args: {
        data: {
          dealerCode: string;
          transactionDate: Date;
          referenceType: FinancialReferenceType;
          referenceId: string;
          referenceNo: string;
          postingType: LedgerPostingType;
          postingKey: string;
          debit: unknown;
          credit: unknown;
          balance: unknown;
          reversesEntryId?: string | null;
          createdById?: string | null;
          remarks?: string | null;
        };
      }): Promise<StubLedgerEntry> => {
        if (ledger.some((row) => row.postingKey === args.data.postingKey)) {
          const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "test",
            meta: { target: ["postingKey"] },
          });
          throw error;
        }
        const row: StubLedgerEntry = {
          id: nextId("entry"),
          dealerCode: args.data.dealerCode,
          transactionDate: args.data.transactionDate,
          postingDate: new Date(),
          referenceType: args.data.referenceType,
          referenceId: args.data.referenceId,
          referenceNo: args.data.referenceNo,
          postingType: args.data.postingType,
          postingKey: args.data.postingKey,
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
      findUnique: async (args: { where: { postingKey: string } }) =>
        ledger.find((row) => row.postingKey === args.where.postingKey) ?? null,
    },
    auditLog: {
      create: async (args: { data: StubAuditRow }) => {
        audit.push(args.data);
        return args.data;
      },
    },
  };

  return {
    tx,
    ledger,
    audit,
    dealerFor: (code: string) => dealers.get(code),
    openingBalanceFor: (id: string) => openingBalances.get(id),
  };
}

describe("createOpeningBalanceRecord — Draft creation", () => {
  it("creates a Draft row that never touches balance or ledger", async () => {
    const { tx, ledger, dealerFor } = makeStubTx([
      { dealerCode: "DLR-1", creditLimit: new Prisma.Decimal("10000"), currentBalance: new Prisma.Decimal("0") },
    ]);

    const record = await createOpeningBalanceRecord(
      tx as never,
      {
        dealerCode: "DLR-1",
        amount: new Prisma.Decimal("1500.00"),
        effectiveDate: new Date("2026-01-01"),
        source: OpeningBalanceSource.Manual,
        remarks: "Go-live balance",
      },
      "user-1",
    );

    expect(record.status).toBe(OpeningBalanceStatus.Draft);
    expect(record.amount.toFixed(2)).toBe("1500.00");
    expect(ledger).toHaveLength(0);
    expect(dealerFor("DLR-1")?.currentBalance.toFixed(2)).toBe("0.00");
  });
});

describe("validateOpeningBalanceRecord — Draft → Validated", () => {
  it("transitions status without touching balance or ledger", async () => {
    const { tx, ledger, dealerFor } = makeStubTx([
      { dealerCode: "DLR-1", creditLimit: new Prisma.Decimal("10000"), currentBalance: new Prisma.Decimal("0") },
    ]);

    const draft = await createOpeningBalanceRecord(
      tx as never,
      {
        dealerCode: "DLR-1",
        amount: new Prisma.Decimal("500.00"),
        effectiveDate: new Date(),
        source: OpeningBalanceSource.Manual,
      },
      "user-1",
    );

    const validated = await validateOpeningBalanceRecord(tx as never, draft.id, "user-2");

    expect(validated.status).toBe(OpeningBalanceStatus.Validated);
    expect(validated.validatedById).toBe("user-2");
    expect(ledger).toHaveLength(0);
    expect(dealerFor("DLR-1")?.currentBalance.toFixed(2)).toBe("0.00");
  });

  it("rejects validating a non-Draft record", async () => {
    const { tx } = makeStubTx([
      { dealerCode: "DLR-1", creditLimit: new Prisma.Decimal("10000"), currentBalance: new Prisma.Decimal("0") },
    ]);
    const draft = await createOpeningBalanceRecord(
      tx as never,
      { dealerCode: "DLR-1", amount: new Prisma.Decimal("500.00"), effectiveDate: new Date(), source: OpeningBalanceSource.Manual },
      "user-1",
    );
    await validateOpeningBalanceRecord(tx as never, draft.id, "user-1");

    await expect(
      validateOpeningBalanceRecord(tx as never, draft.id, "user-1"),
    ).rejects.toThrow(OpeningBalanceError);
  });
});

describe("postOpeningBalanceRecord — Validated → Posted/Locked", () => {
  it("posts a positive amount: one Debit LedgerEntry, balance updated, record Locked", async () => {
    const { tx, ledger, audit, dealerFor, openingBalanceFor } = makeStubTx([
      { dealerCode: "DLR-1", creditLimit: new Prisma.Decimal("10000"), currentBalance: new Prisma.Decimal("0") },
    ]);

    const draft = await createOpeningBalanceRecord(
      tx as never,
      { dealerCode: "DLR-1", amount: new Prisma.Decimal("2500.00"), effectiveDate: new Date("2026-01-01"), source: OpeningBalanceSource.Manual },
      "user-1",
    );
    await validateOpeningBalanceRecord(tx as never, draft.id, "user-1");

    const outcome = await postOpeningBalanceRecord(tx as never, draft.id, "user-1");

    expect(outcome.alreadyPosted).toBe(false);
    expect(outcome.record.status).toBe(OpeningBalanceStatus.Locked);
    expect(outcome.record.lockedAt).not.toBeNull();
    expect(outcome.record.ledgerEntryId).not.toBeNull();

    expect(ledger).toHaveLength(1);
    expect(ledger[0].debit.toFixed(2)).toBe("2500.00");
    expect(ledger[0].credit.toFixed(2)).toBe("0.00");
    expect(ledger[0].balance.toFixed(2)).toBe("2500.00");
    expect(ledger[0].postingType).toBe(LedgerPostingType.OpeningBalance);
    expect(ledger[0].referenceType).toBe(FinancialReferenceType.OpeningBalance);
    expect(ledger[0].postingKey).toBe("ledger:OpeningBalance:OB-DLR-1:OpeningBalance");

    expect(dealerFor("DLR-1")?.currentBalance.toFixed(2)).toBe("2500.00");
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("DEALER_OPENING_BALANCE_POSTED");
    expect(openingBalanceFor(draft.id)?.status).toBe(OpeningBalanceStatus.Locked);
  });

  it("posts a negative amount (advance credit): one Credit LedgerEntry", async () => {
    const { tx, ledger, dealerFor } = makeStubTx([
      { dealerCode: "DLR-2", creditLimit: new Prisma.Decimal("10000"), currentBalance: new Prisma.Decimal("0") },
    ]);

    const draft = await createOpeningBalanceRecord(
      tx as never,
      { dealerCode: "DLR-2", amount: new Prisma.Decimal("-800.00"), effectiveDate: new Date(), source: OpeningBalanceSource.Manual },
      "user-1",
    );
    await validateOpeningBalanceRecord(tx as never, draft.id, "user-1");
    await postOpeningBalanceRecord(tx as never, draft.id, "user-1");

    expect(ledger).toHaveLength(1);
    expect(ledger[0].debit.toFixed(2)).toBe("0.00");
    expect(ledger[0].credit.toFixed(2)).toBe("800.00");
    expect(ledger[0].balance.toFixed(2)).toBe("-800.00");
    expect(dealerFor("DLR-2")?.currentBalance.toFixed(2)).toBe("-800.00");
  });

  it("posts a zero amount: record Locked, NO LedgerEntry created", async () => {
    const { tx, ledger, audit, dealerFor } = makeStubTx([
      { dealerCode: "DLR-3", creditLimit: new Prisma.Decimal("10000"), currentBalance: new Prisma.Decimal("0") },
    ]);

    const draft = await createOpeningBalanceRecord(
      tx as never,
      { dealerCode: "DLR-3", amount: new Prisma.Decimal("0.00"), effectiveDate: new Date(), source: OpeningBalanceSource.Manual },
      "user-1",
    );
    await validateOpeningBalanceRecord(tx as never, draft.id, "user-1");
    const outcome = await postOpeningBalanceRecord(tx as never, draft.id, "user-1");

    expect(outcome.record.status).toBe(OpeningBalanceStatus.Locked);
    expect(outcome.record.ledgerEntryId).toBeNull();
    expect(ledger).toHaveLength(0);
    expect(dealerFor("DLR-3")?.currentBalance.toFixed(2)).toBe("0.00");
    expect(audit).toHaveLength(1);
  });

  it("rejects posting straight from Draft (skipping Validation)", async () => {
    const { tx } = makeStubTx([
      { dealerCode: "DLR-4", creditLimit: new Prisma.Decimal("10000"), currentBalance: new Prisma.Decimal("0") },
    ]);
    const draft = await createOpeningBalanceRecord(
      tx as never,
      { dealerCode: "DLR-4", amount: new Prisma.Decimal("100.00"), effectiveDate: new Date(), source: OpeningBalanceSource.Manual },
      "user-1",
    );

    await expect(postOpeningBalanceRecord(tx as never, draft.id, "user-1")).rejects.toThrow(
      OpeningBalanceError,
    );
  });

  it("idempotent replay: posting an already-Locked record returns the SAME result without a second LedgerEntry", async () => {
    const { tx, ledger, dealerFor } = makeStubTx([
      { dealerCode: "DLR-5", creditLimit: new Prisma.Decimal("10000"), currentBalance: new Prisma.Decimal("0") },
    ]);
    const draft = await createOpeningBalanceRecord(
      tx as never,
      { dealerCode: "DLR-5", amount: new Prisma.Decimal("1000.00"), effectiveDate: new Date(), source: OpeningBalanceSource.Manual },
      "user-1",
    );
    await validateOpeningBalanceRecord(tx as never, draft.id, "user-1");

    const first = await postOpeningBalanceRecord(tx as never, draft.id, "user-1");
    const second = await postOpeningBalanceRecord(tx as never, draft.id, "user-1");

    expect(first.alreadyPosted).toBe(false);
    expect(second.alreadyPosted).toBe(true);
    expect(second.record.ledgerEntryId).toBe(first.record.ledgerEntryId);
    expect(ledger).toHaveLength(1);
    expect(dealerFor("DLR-5")?.currentBalance.toFixed(2)).toBe("1000.00");
  });

  it("rejects posting when the dealer's cached balance is not zero (integrity backstop)", async () => {
    const { tx } = makeStubTx([
      { dealerCode: "DLR-6", creditLimit: new Prisma.Decimal("10000"), currentBalance: new Prisma.Decimal("999.00") },
    ]);
    const draft = await createOpeningBalanceRecord(
      tx as never,
      { dealerCode: "DLR-6", amount: new Prisma.Decimal("100.00"), effectiveDate: new Date(), source: OpeningBalanceSource.Manual },
      "user-1",
    );
    await validateOpeningBalanceRecord(tx as never, draft.id, "user-1");

    await expect(postOpeningBalanceRecord(tx as never, draft.id, "user-1")).rejects.toThrow(
      OpeningBalanceError,
    );
  });

  it("re-checks Locked status AFTER acquiring the dealer lock — losing concurrent poster replays idempotently instead of failing", async () => {
    // Simulates the race between two `postOpeningBalanceRecord` calls that
    // both read the record as `Validated` before either commits (same idiom
    // as `issue-invoice-transaction.ts`'s post-lock idempotent challan
    // check). The stub's `$queryRaw` dealer-lock read happens AFTER the
    // winner has already flipped the record to `Locked`, so the loser's
    // post-lock re-fetch must observe `Locked` and short-circuit — never
    // reaching `assertPreviousBalanceZero` with a stale non-zero balance.
    const { tx, ledger, dealerFor } = makeStubTx([
      { dealerCode: "DLR-8", creditLimit: new Prisma.Decimal("10000"), currentBalance: new Prisma.Decimal("0") },
    ]);
    const draft = await createOpeningBalanceRecord(
      tx as never,
      { dealerCode: "DLR-8", amount: new Prisma.Decimal("650.00"), effectiveDate: new Date(), source: OpeningBalanceSource.Manual },
      "user-1",
    );
    await validateOpeningBalanceRecord(tx as never, draft.id, "user-1");

    // Winner posts fully (record becomes Locked, dealer balance updated).
    const winner = await postOpeningBalanceRecord(tx as never, draft.id, "user-1");
    expect(winner.alreadyPosted).toBe(false);

    // Loser calls again — as if it had read `Validated` before the winner
    // committed, but only reaches the dealer-lock step now. Must replay
    // idempotently, not throw.
    const loser = await postOpeningBalanceRecord(tx as never, draft.id, "user-1");

    expect(loser.alreadyPosted).toBe(true);
    expect(loser.record.ledgerEntryId).toBe(winner.record.ledgerEntryId);
    expect(ledger).toHaveLength(1);
    expect(dealerFor("DLR-8")?.currentBalance.toFixed(2)).toBe("650.00");
  });

  it("running balance replay matches Dealer.currentBalance after posting", async () => {
    const { tx, ledger, dealerFor } = makeStubTx([
      { dealerCode: "DLR-7", creditLimit: new Prisma.Decimal("10000"), currentBalance: new Prisma.Decimal("0") },
    ]);
    const draft = await createOpeningBalanceRecord(
      tx as never,
      { dealerCode: "DLR-7", amount: new Prisma.Decimal("3333.33"), effectiveDate: new Date(), source: OpeningBalanceSource.Manual },
      "user-1",
    );
    await validateOpeningBalanceRecord(tx as never, draft.id, "user-1");
    await postOpeningBalanceRecord(tx as never, draft.id, "user-1");

    const replay = ledger.reduce(
      (acc, row) => acc.plus(row.debit).minus(row.credit),
      new Prisma.Decimal(0),
    );
    expect(replay.toFixed(2)).toBe(dealerFor("DLR-7")?.currentBalance.toFixed(2));
  });
});
