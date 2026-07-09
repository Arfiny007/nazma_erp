import { describe, expect, it } from "vitest";
import {
  FinancialReferenceType,
  LedgerPostingType,
  Prisma,
} from "@prisma/client";

import {
  LedgerBalanceMismatchError,
  LedgerDuplicatePostingError,
  assertLedgerBalanceMatchesCache,
  createLedgerEntry,
  type LedgerPostingInput,
} from "@/lib/ledger";

/**
 * Unit tests for `createLedgerEntry` — the single ledger write path.
 *
 * These validate:
 *   1. Successful insert produces a `LedgerPostingResult` with `isNew = true`.
 *   2. Duplicate `postingKey` with matching payload is a replay-safe no-op
 *      (`isNew = false`) — this is the primary idempotency guarantee under
 *      Prisma transaction retries.
 *   3. Duplicate `postingKey` with divergent payload raises
 *      `LedgerDuplicatePostingError` — surfaces genuine posting bugs instead
 *      of silently corrupting the subledger.
 *   4. `assertLedgerBalanceMatchesCache` raises `LedgerBalanceMismatchError`
 *      on drift and is a no-op when the two values agree.
 */

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
  if (Prisma.Decimal.isDecimal(value)) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Prisma.Decimal(value);
  }
  throw new Error(`Unsupported Decimal input: ${String(value)}`);
}

function makeTx(): {
  tx: LedgerPostingInput["tx"];
  rows: StubLedgerRow[];
} {
  const rows: StubLedgerRow[] = [];
  let idCounter = 0;

  const tx = {
    ledgerEntry: {
      create: async (args: { data: StubLedgerRow }) => {
        if (rows.some((r) => r.postingKey === args.data.postingKey)) {
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
          id: `row-${idCounter}`,
          postingDate: new Date(),
          debit: toDecimal(args.data.debit),
          credit: toDecimal(args.data.credit),
          balance: toDecimal(args.data.balance),
          reversesEntryId: args.data.reversesEntryId ?? null,
          createdById: args.data.createdById ?? null,
          remarks: args.data.remarks ?? null,
        };
        rows.push(row);
        return row;
      },
      findUnique: async (args: { where: { postingKey: string } }) => {
        return rows.find((r) => r.postingKey === args.where.postingKey) ?? null;
      },
    },
  } as unknown as LedgerPostingInput["tx"];

  return { tx, rows };
}

function baseInput(
  tx: LedgerPostingInput["tx"],
  overrides: Partial<LedgerPostingInput> = {},
): LedgerPostingInput {
  return {
    tx,
    dealerCode: "DLR-1",
    transactionDate: new Date("2026-07-01T00:00:00Z"),
    referenceType: FinancialReferenceType.Invoice,
    referenceId: "inv-1",
    referenceNo: "INV-000001",
    postingType: LedgerPostingType.Issue,
    debit: new Prisma.Decimal("1000.00"),
    credit: new Prisma.Decimal("0.00"),
    previousBalance: new Prisma.Decimal("0.00"),
    createdById: "user-1",
    ...overrides,
  };
}

describe("createLedgerEntry", () => {
  it("inserts a new row and returns isNew = true", async () => {
    const { tx, rows } = makeTx();

    const result = await createLedgerEntry(baseInput(tx));

    expect(result.isNew).toBe(true);
    expect(result.balance.toFixed(2)).toBe("1000.00");
    expect(rows).toHaveLength(1);
  });

  it("collapses idempotent replays into a no-op (P2002 → returns existing)", async () => {
    const { tx, rows } = makeTx();

    const input = baseInput(tx);
    const first = await createLedgerEntry(input);
    const second = await createLedgerEntry(input);

    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
    expect(second.id).toBe(first.id);
    expect(rows).toHaveLength(1);
  });

  it("raises LedgerDuplicatePostingError when replay disagrees on payload", async () => {
    const { tx, rows } = makeTx();

    await createLedgerEntry(baseInput(tx));

    await expect(
      createLedgerEntry(
        baseInput(tx, { debit: new Prisma.Decimal("9999.00") }),
      ),
    ).rejects.toBeInstanceOf(LedgerDuplicatePostingError);

    // Original row untouched — ledger remained append-only.
    expect(rows).toHaveLength(1);
    expect(rows[0].debit.toFixed(2)).toBe("1000.00");
  });

  it("computes running balance = previousBalance + debit − credit", async () => {
    const { tx } = makeTx();
    const result = await createLedgerEntry(
      baseInput(tx, {
        previousBalance: new Prisma.Decimal("200.00"),
        debit: new Prisma.Decimal("0.00"),
        credit: new Prisma.Decimal("500.00"),
        postingType: LedgerPostingType.Collection,
        referenceType: FinancialReferenceType.Collection,
        referenceId: "col-1",
        referenceNo: "COL-1",
      }),
    );

    expect(result.balance.toFixed(2)).toBe("-300.00");
  });
});

describe("assertLedgerBalanceMatchesCache", () => {
  it("is a no-op when the two balances agree", () => {
    expect(() =>
      assertLedgerBalanceMatchesCache(
        "DLR-1",
        new Prisma.Decimal("500.00"),
        new Prisma.Decimal("500.00"),
      ),
    ).not.toThrow();
  });

  it("raises LedgerBalanceMismatchError on drift", () => {
    expect(() =>
      assertLedgerBalanceMatchesCache(
        "DLR-1",
        new Prisma.Decimal("500.00"),
        new Prisma.Decimal("501.00"),
      ),
    ).toThrow(LedgerBalanceMismatchError);
  });

  it("distinguishes signed advance credit from positive AR", () => {
    expect(() =>
      assertLedgerBalanceMatchesCache(
        "DLR-1",
        new Prisma.Decimal("-100.00"),
        new Prisma.Decimal("100.00"),
      ),
    ).toThrow(LedgerBalanceMismatchError);
  });
});
