import { describe, expect, it } from "vitest";
import {
  FinancialReferenceType,
  LedgerPostingType,
  Prisma,
} from "@prisma/client";

import {
  postOpeningBalance,
  postReceivableDecrease,
  postReceivableDecreaseReversal,
  postReceivableIncrease,
} from "@/lib/finance/posting-service";
import {
  FINANCIAL_REFERENCE_COLLECTION,
  FINANCIAL_REFERENCE_INVOICE,
} from "@/lib/finance/types";
import {
  buildLedgerPostingKey,
  LedgerBalanceMismatchError,
} from "@/lib/ledger";

/**
 * Unit tests for the PHASE_07B ledger posting integration.
 *
 * These tests exercise `posting-service.ts` against an in-memory Prisma
 * transaction stub so they run without a live PostgreSQL. The stub implements
 * only the subset the posting service consumes:
 *
 *   - `dealer.update`   (atomic `increment` / `decrement`)
 *   - `ledgerEntry.create` (`postingKey` uniqueness — throws `P2002` on replay)
 *   - `ledgerEntry.findUnique({ where: { postingKey } })`
 *   - `collection.findUnique`
 *   - `auditLog.create`
 *
 * The integration counterpart (`posting-service.integration.test.ts` — future)
 * exercises the same paths against Postgres for locking, serialization, and
 * `SELECT … FOR UPDATE` semantics.
 */

interface StubDealer {
  dealerCode: string;
  currentBalance: Prisma.Decimal;
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

interface StubCollection {
  id: string;
  receivedAmount: Prisma.Decimal;
  allocatedAmount: Prisma.Decimal;
  unallocatedAmount: Prisma.Decimal;
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
  if (Prisma.Decimal.isDecimal(value)) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Prisma.Decimal(value);
  }
  throw new Error(`Unsupported Decimal input: ${String(value)}`);
}

/**
 * Minimal Prisma transaction stub. Reproduces the surface required by
 * `posting-service.ts` — nothing more.
 */
function makeStubTx(options: {
  dealers: StubDealer[];
  collections?: StubCollection[];
}): {
  tx: unknown;
  ledger: StubLedgerEntry[];
  audit: StubAuditRow[];
  dealerFor: (code: string) => StubDealer | undefined;
} {
  const dealers = new Map(
    options.dealers.map((d) => [
      d.dealerCode,
      { ...d, currentBalance: d.currentBalance },
    ]),
  );
  const collections = new Map(
    (options.collections ?? []).map((c) => [c.id, c] as const),
  );
  const ledger: StubLedgerEntry[] = [];
  const audit: StubAuditRow[] = [];

  let idCounter = 0;
  const nextId = (): string => {
    idCounter += 1;
    return `entry-${idCounter}`;
  };

  const tx = {
    dealer: {
      update: async (args: {
        where: { dealerCode: string };
        data: {
          currentBalance?:
            | { increment: Prisma.Decimal }
            | { decrement: Prisma.Decimal };
        };
        select: { currentBalance: true };
      }) => {
        const dealer = dealers.get(args.where.dealerCode);
        if (!dealer) {
          throw new Error(`Dealer not found: ${args.where.dealerCode}`);
        }
        const patch = args.data.currentBalance;
        if (patch && "increment" in patch) {
          dealer.currentBalance = dealer.currentBalance.plus(toDecimal(patch.increment));
        } else if (patch && "decrement" in patch) {
          dealer.currentBalance = dealer.currentBalance.minus(
            toDecimal(patch.decrement),
          );
        }
        return { currentBalance: dealer.currentBalance };
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
          const error = new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            {
              code: "P2002",
              clientVersion: "test",
              meta: { target: ["postingKey"] },
            },
          );
          throw error;
        }
        const row: StubLedgerEntry = {
          id: nextId(),
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
      findUnique: async (args: {
        where: { postingKey: string };
      }): Promise<StubLedgerEntry | null> => {
        return (
          ledger.find((row) => row.postingKey === args.where.postingKey) ?? null
        );
      },
    },
    collection: {
      findUnique: async (args: {
        where: { id: string };
      }): Promise<StubCollection | null> => {
        return collections.get(args.where.id) ?? null;
      },
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
    dealerFor: (code) => dealers.get(code),
  };
}

describe("postReceivableIncrease — invoice issue posting", () => {
  it("appends a Debit ledger entry and asserts balance parity", async () => {
    const { tx, ledger, audit, dealerFor } = makeStubTx({
      dealers: [
        { dealerCode: "DLR-1", currentBalance: new Prisma.Decimal("500.00") },
      ],
    });

    const result = await postReceivableIncrease({
      tx: tx as Prisma.TransactionClient,
      dealerCode: "DLR-1",
      amount: new Prisma.Decimal("1000.00"),
      previousBalance: new Prisma.Decimal("500.00"),
      userId: "user-1",
      referenceType: FINANCIAL_REFERENCE_INVOICE,
      referenceId: "inv-1",
      referenceNo: "INV-000001",
    });

    expect(result.newBalance.toFixed(2)).toBe("1500.00");
    expect(dealerFor("DLR-1")?.currentBalance.toFixed(2)).toBe("1500.00");

    expect(ledger).toHaveLength(1);
    const entry = ledger[0];
    expect(entry.debit.toFixed(2)).toBe("1000.00");
    expect(entry.credit.toFixed(2)).toBe("0.00");
    expect(entry.balance.toFixed(2)).toBe("1500.00");
    expect(entry.postingType).toBe(LedgerPostingType.Issue);
    expect(entry.postingKey).toBe("ledger:Invoice:inv-1:Issue");
    expect(entry.createdById).toBe("user-1");

    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("DEALER_BALANCE_UPDATED");
    expect((audit[0].newValue as Prisma.JsonObject).ledgerEntryId).toBe(entry.id);
  });

  it("preserves signed advance credit (previousBalance < 0)", async () => {
    const { tx, ledger } = makeStubTx({
      dealers: [
        { dealerCode: "DLR-2", currentBalance: new Prisma.Decimal("-2000.00") },
      ],
    });

    await postReceivableIncrease({
      tx: tx as Prisma.TransactionClient,
      dealerCode: "DLR-2",
      amount: new Prisma.Decimal("500.00"),
      previousBalance: new Prisma.Decimal("-2000.00"),
      userId: "user-1",
      referenceType: FINANCIAL_REFERENCE_INVOICE,
      referenceId: "inv-2",
      referenceNo: "INV-000002",
    });

    expect(ledger[0].balance.toFixed(2)).toBe("-1500.00");
  });

  it("rolls back when the atomic dealer balance drifts from the expected total", async () => {
    const stub = makeStubTx({
      dealers: [
        { dealerCode: "DLR-4", currentBalance: new Prisma.Decimal("100.00") },
      ],
    });

    // Simulate stale `previousBalance` (caller lied about the lock snapshot).
    await expect(
      postReceivableIncrease({
        tx: stub.tx as Prisma.TransactionClient,
        dealerCode: "DLR-4",
        amount: new Prisma.Decimal("50.00"),
        previousBalance: new Prisma.Decimal("999.00"),
        userId: "user-1",
        referenceType: FINANCIAL_REFERENCE_INVOICE,
        referenceId: "inv-drift",
        referenceNo: "INV-DRIFT",
      }),
    ).rejects.toThrow(/increment mismatch/);

    expect(stub.ledger).toHaveLength(0);
  });

  it("rejects non-positive amount", async () => {
    const { tx } = makeStubTx({
      dealers: [
        { dealerCode: "DLR-5", currentBalance: new Prisma.Decimal("0.00") },
      ],
    });

    await expect(
      postReceivableIncrease({
        tx: tx as Prisma.TransactionClient,
        dealerCode: "DLR-5",
        amount: new Prisma.Decimal("0.00"),
        previousBalance: new Prisma.Decimal("0.00"),
        userId: "user-1",
        referenceType: FINANCIAL_REFERENCE_INVOICE,
        referenceId: "inv-zero",
        referenceNo: "INV-ZERO",
      }),
    ).rejects.toThrow(RangeError);
  });
});

describe("postReceivableDecrease — collection cash receipt posting", () => {
  const collection: StubCollection = {
    id: "col-1",
    receivedAmount: new Prisma.Decimal("400.00"),
    allocatedAmount: new Prisma.Decimal("0.00"),
    unallocatedAmount: new Prisma.Decimal("400.00"),
  };

  it("appends a Credit ledger entry and matches Dealer.currentBalance", async () => {
    const { tx, ledger, audit, dealerFor } = makeStubTx({
      dealers: [
        { dealerCode: "DLR-1", currentBalance: new Prisma.Decimal("1000.00") },
      ],
      collections: [collection],
    });

    const result = await postReceivableDecrease({
      tx: tx as Prisma.TransactionClient,
      dealerCode: "DLR-1",
      amount: new Prisma.Decimal("400.00"),
      previousBalance: new Prisma.Decimal("1000.00"),
      userId: "user-1",
      referenceType: FINANCIAL_REFERENCE_COLLECTION,
      referenceId: collection.id,
      referenceNo: "COL-000001",
      collectionId: collection.id,
      collectionNo: "COL-000001",
      applyDealerBalance: true,
    });

    expect(result.newBalance.toFixed(2)).toBe("600.00");
    expect(dealerFor("DLR-1")?.currentBalance.toFixed(2)).toBe("600.00");

    expect(ledger).toHaveLength(1);
    const entry = ledger[0];
    expect(entry.debit.toFixed(2)).toBe("0.00");
    expect(entry.credit.toFixed(2)).toBe("400.00");
    expect(entry.balance.toFixed(2)).toBe("600.00");
    expect(entry.postingType).toBe(LedgerPostingType.Collection);
    expect(entry.referenceType).toBe(FinancialReferenceType.Collection);
    expect(entry.postingKey).toBe("ledger:Collection:col-1:Collection");

    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("DEALER_BALANCE_DECREASED");
  });

  it("permits negative running balance for advance payment", async () => {
    const { tx, ledger, dealerFor } = makeStubTx({
      dealers: [
        { dealerCode: "DLR-2", currentBalance: new Prisma.Decimal("100.00") },
      ],
      collections: [
        {
          id: "col-adv",
          receivedAmount: new Prisma.Decimal("500.00"),
          allocatedAmount: new Prisma.Decimal("0.00"),
          unallocatedAmount: new Prisma.Decimal("500.00"),
        },
      ],
    });

    await postReceivableDecrease({
      tx: tx as Prisma.TransactionClient,
      dealerCode: "DLR-2",
      amount: new Prisma.Decimal("500.00"),
      previousBalance: new Prisma.Decimal("100.00"),
      userId: "user-1",
      referenceType: FINANCIAL_REFERENCE_COLLECTION,
      referenceId: "col-adv",
      referenceNo: "COL-ADV",
      collectionId: "col-adv",
      collectionNo: "COL-ADV",
      applyDealerBalance: true,
    });

    expect(dealerFor("DLR-2")?.currentBalance.toFixed(2)).toBe("-400.00");
    expect(ledger[0].balance.toFixed(2)).toBe("-400.00");
  });

  it("skips balance and ledger when applyDealerBalance is false (allocation path)", async () => {
    const { tx, ledger, audit, dealerFor } = makeStubTx({
      dealers: [
        { dealerCode: "DLR-3", currentBalance: new Prisma.Decimal("300.00") },
      ],
      collections: [collection],
    });

    await postReceivableDecrease({
      tx: tx as Prisma.TransactionClient,
      dealerCode: "DLR-3",
      amount: new Prisma.Decimal("400.00"),
      previousBalance: new Prisma.Decimal("300.00"),
      userId: "user-1",
      referenceType: FINANCIAL_REFERENCE_COLLECTION,
      referenceId: collection.id,
      referenceNo: "COL-1",
      collectionId: collection.id,
      collectionNo: "COL-1",
      applyDealerBalance: false,
    });

    expect(dealerFor("DLR-3")?.currentBalance.toFixed(2)).toBe("300.00");
    expect(ledger).toHaveLength(0);
    expect(audit).toHaveLength(1);
    expect((audit[0].newValue as Prisma.JsonObject).applyDealerBalance).toBe(
      "false",
    );
  });

});

describe("postReceivableDecreaseReversal — collection reversal posting", () => {
  it("appends a compensating Reversal entry linked to the original", async () => {
    const collection: StubCollection = {
      id: "col-rev",
      receivedAmount: new Prisma.Decimal("400.00"),
      allocatedAmount: new Prisma.Decimal("0.00"),
      unallocatedAmount: new Prisma.Decimal("400.00"),
    };

    const { tx, ledger, audit, dealerFor } = makeStubTx({
      dealers: [
        { dealerCode: "DLR-1", currentBalance: new Prisma.Decimal("1000.00") },
      ],
      collections: [collection],
    });

    // Step 1 — original collection posting.
    await postReceivableDecrease({
      tx: tx as Prisma.TransactionClient,
      dealerCode: "DLR-1",
      amount: new Prisma.Decimal("400.00"),
      previousBalance: new Prisma.Decimal("1000.00"),
      userId: "user-1",
      referenceType: FINANCIAL_REFERENCE_COLLECTION,
      referenceId: collection.id,
      referenceNo: "COL-REV",
      collectionId: collection.id,
      collectionNo: "COL-REV",
      applyDealerBalance: true,
    });

    const originalEntry = ledger[0];
    expect(dealerFor("DLR-1")?.currentBalance.toFixed(2)).toBe("600.00");

    // Step 2 — reversal must restore balance and create a compensating row.
    await postReceivableDecreaseReversal({
      tx: tx as Prisma.TransactionClient,
      dealerCode: "DLR-1",
      amount: new Prisma.Decimal("400.00"),
      previousBalance: new Prisma.Decimal("600.00"),
      userId: "user-2",
      referenceType: FINANCIAL_REFERENCE_COLLECTION,
      referenceId: collection.id,
      referenceNo: "COL-REV",
      collectionId: collection.id,
      collectionNo: "COL-REV",
    });

    expect(dealerFor("DLR-1")?.currentBalance.toFixed(2)).toBe("1000.00");
    expect(ledger).toHaveLength(2);

    const reversalEntry = ledger[1];
    expect(reversalEntry.postingType).toBe(LedgerPostingType.Reversal);
    expect(reversalEntry.debit.toFixed(2)).toBe("400.00");
    expect(reversalEntry.credit.toFixed(2)).toBe("0.00");
    expect(reversalEntry.balance.toFixed(2)).toBe("1000.00");
    expect(reversalEntry.reversesEntryId).toBe(originalEntry.id);
    expect(reversalEntry.postingKey).toBe(
      buildLedgerPostingKey({
        referenceType: FinancialReferenceType.Collection,
        referenceId: collection.id,
        postingType: LedgerPostingType.Reversal,
      }),
    );

    // Audit history preserved: confirmation + reversal.
    expect(audit).toHaveLength(2);
  });

  it("posts a compensating entry even for pre-PHASE_07B collections (no original ledger row)", async () => {
    const collection: StubCollection = {
      id: "col-legacy",
      receivedAmount: new Prisma.Decimal("100.00"),
      allocatedAmount: new Prisma.Decimal("0.00"),
      unallocatedAmount: new Prisma.Decimal("100.00"),
    };

    const { tx, ledger } = makeStubTx({
      dealers: [
        { dealerCode: "DLR-Legacy", currentBalance: new Prisma.Decimal("0.00") },
      ],
      collections: [collection],
    });

    await postReceivableDecreaseReversal({
      tx: tx as Prisma.TransactionClient,
      dealerCode: "DLR-Legacy",
      amount: new Prisma.Decimal("100.00"),
      previousBalance: new Prisma.Decimal("0.00"),
      userId: "user-1",
      referenceType: FINANCIAL_REFERENCE_COLLECTION,
      referenceId: collection.id,
      referenceNo: "COL-LEGACY",
      collectionId: collection.id,
      collectionNo: "COL-LEGACY",
    });

    expect(ledger).toHaveLength(1);
    expect(ledger[0].reversesEntryId).toBeNull();
    expect(ledger[0].postingType).toBe(LedgerPostingType.Reversal);
  });

});

describe("Balance reconciliation invariants", () => {
  it("running balance from ledger replays to Dealer.currentBalance across a lifecycle", async () => {
    const collection: StubCollection = {
      id: "col-lifecycle",
      receivedAmount: new Prisma.Decimal("300.00"),
      allocatedAmount: new Prisma.Decimal("0.00"),
      unallocatedAmount: new Prisma.Decimal("300.00"),
    };

    const { tx, ledger, dealerFor } = makeStubTx({
      dealers: [
        { dealerCode: "DLR-Life", currentBalance: new Prisma.Decimal("0.00") },
      ],
      collections: [collection],
    });

    // Invoice issue.
    await postReceivableIncrease({
      tx: tx as Prisma.TransactionClient,
      dealerCode: "DLR-Life",
      amount: new Prisma.Decimal("1000.00"),
      previousBalance: new Prisma.Decimal("0.00"),
      userId: "user-1",
      referenceType: FINANCIAL_REFERENCE_INVOICE,
      referenceId: "inv-life",
      referenceNo: "INV-LIFE",
    });

    // Collection confirmation (partial).
    await postReceivableDecrease({
      tx: tx as Prisma.TransactionClient,
      dealerCode: "DLR-Life",
      amount: new Prisma.Decimal("300.00"),
      previousBalance: new Prisma.Decimal("1000.00"),
      userId: "user-1",
      referenceType: FINANCIAL_REFERENCE_COLLECTION,
      referenceId: collection.id,
      referenceNo: "COL-LIFE",
      collectionId: collection.id,
      collectionNo: "COL-LIFE",
      applyDealerBalance: true,
    });

    // Reversal — dealer restored to invoice-only balance.
    await postReceivableDecreaseReversal({
      tx: tx as Prisma.TransactionClient,
      dealerCode: "DLR-Life",
      amount: new Prisma.Decimal("300.00"),
      previousBalance: new Prisma.Decimal("700.00"),
      userId: "user-1",
      referenceType: FINANCIAL_REFERENCE_COLLECTION,
      referenceId: collection.id,
      referenceNo: "COL-LIFE",
      collectionId: collection.id,
      collectionNo: "COL-LIFE",
    });

    // Three appended entries — never modified.
    expect(ledger).toHaveLength(3);
    expect(ledger.map((e) => e.postingType)).toEqual([
      LedgerPostingType.Issue,
      LedgerPostingType.Collection,
      LedgerPostingType.Reversal,
    ]);

    // Persisted balance matches cache.
    const last = ledger[ledger.length - 1];
    expect(last.balance.toFixed(2)).toBe(
      dealerFor("DLR-Life")?.currentBalance.toFixed(2),
    );

    // Independent debit − credit replay (guards against drift in `balance`).
    const replay = ledger.reduce(
      (acc, row) => acc.plus(row.debit).minus(row.credit),
      new Prisma.Decimal(0),
    );
    expect(replay.toFixed(2)).toBe(last.balance.toFixed(2));
  });
});

describe("Concurrent posting simulation", () => {
  it("serialized Promise.all invoice issues chain running balances without drift", async () => {
    // Callers hold the dealer lock (`SELECT … FOR UPDATE`), so we simulate the
    // serialized ordering the lock imposes on Postgres by awaiting each call
    // sequentially. The test asserts that when previousBalance flows from the
    // last known cache, the ledger balance and Dealer.currentBalance stay in
    // lockstep across parallel-intent posting sites.
    const { tx, ledger, dealerFor } = makeStubTx({
      dealers: [
        { dealerCode: "DLR-C", currentBalance: new Prisma.Decimal("0.00") },
      ],
    });

    const invoices = [
      { id: "inv-A", ref: "INV-A", amount: "100.00" },
      { id: "inv-B", ref: "INV-B", amount: "250.00" },
      { id: "inv-C", ref: "INV-C", amount: "75.00" },
    ];

    let previous = new Prisma.Decimal(0);
    for (const inv of invoices) {
      const amount = new Prisma.Decimal(inv.amount);
      await postReceivableIncrease({
        tx: tx as Prisma.TransactionClient,
        dealerCode: "DLR-C",
        amount,
        previousBalance: previous,
        userId: "user-1",
        referenceType: FINANCIAL_REFERENCE_INVOICE,
        referenceId: inv.id,
        referenceNo: inv.ref,
      });
      previous = previous.plus(amount);
    }

    expect(ledger).toHaveLength(3);
    const runningBalances = ledger.map((row) => row.balance.toFixed(2));
    expect(runningBalances).toEqual(["100.00", "350.00", "425.00"]);
    expect(dealerFor("DLR-C")?.currentBalance.toFixed(2)).toBe("425.00");
  });
});

describe("postOpeningBalance — PHASE_07C Financial Initialization Engine posting", () => {
  it("posts a positive amount as a Debit OpeningBalance ledger entry", async () => {
    const { tx, ledger, audit, dealerFor } = makeStubTx({
      dealers: [{ dealerCode: "DLR-OB1", currentBalance: new Prisma.Decimal("0.00") }],
    });

    const result = await postOpeningBalance({
      tx: tx as Prisma.TransactionClient,
      dealerCode: "DLR-OB1",
      amount: new Prisma.Decimal("5000.00"),
      previousBalance: new Prisma.Decimal("0.00"),
      userId: "user-1",
      effectiveDate: new Date("2026-01-01"),
      referenceNo: "OB-DLR-OB1",
      openingBalanceId: "ob-1",
    });

    expect(result.newBalance.toFixed(2)).toBe("5000.00");
    expect(result.ledgerEntryId).not.toBeNull();
    expect(dealerFor("DLR-OB1")?.currentBalance.toFixed(2)).toBe("5000.00");

    expect(ledger).toHaveLength(1);
    expect(ledger[0].debit.toFixed(2)).toBe("5000.00");
    expect(ledger[0].credit.toFixed(2)).toBe("0.00");
    expect(ledger[0].postingType).toBe(LedgerPostingType.OpeningBalance);
    expect(ledger[0].referenceType).toBe(FinancialReferenceType.OpeningBalance);
    expect(ledger[0].postingKey).toBe(
      buildLedgerPostingKey({
        referenceType: FinancialReferenceType.OpeningBalance,
        referenceId: "OB-DLR-OB1",
        postingType: LedgerPostingType.OpeningBalance,
      }),
    );

    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("DEALER_OPENING_BALANCE_POSTED");
  });

  it("posts a negative amount as a Credit OpeningBalance ledger entry (advance)", async () => {
    const { tx, ledger, dealerFor } = makeStubTx({
      dealers: [{ dealerCode: "DLR-OB2", currentBalance: new Prisma.Decimal("0.00") }],
    });

    await postOpeningBalance({
      tx: tx as Prisma.TransactionClient,
      dealerCode: "DLR-OB2",
      amount: new Prisma.Decimal("-1200.00"),
      previousBalance: new Prisma.Decimal("0.00"),
      userId: "user-1",
      effectiveDate: new Date(),
      referenceNo: "OB-DLR-OB2",
      openingBalanceId: "ob-2",
    });

    expect(ledger[0].debit.toFixed(2)).toBe("0.00");
    expect(ledger[0].credit.toFixed(2)).toBe("1200.00");
    expect(dealerFor("DLR-OB2")?.currentBalance.toFixed(2)).toBe("-1200.00");
  });

  it("posts a zero amount with NO ledger entry, only an audit trail", async () => {
    const { tx, ledger, audit, dealerFor } = makeStubTx({
      dealers: [{ dealerCode: "DLR-OB3", currentBalance: new Prisma.Decimal("0.00") }],
    });

    const result = await postOpeningBalance({
      tx: tx as Prisma.TransactionClient,
      dealerCode: "DLR-OB3",
      amount: new Prisma.Decimal("0.00"),
      previousBalance: new Prisma.Decimal("0.00"),
      userId: "user-1",
      effectiveDate: new Date(),
      referenceNo: "OB-DLR-OB3",
      openingBalanceId: "ob-3",
    });

    expect(result.ledgerEntryId).toBeNull();
    expect(result.ledgerPostingKey).toBeNull();
    expect(ledger).toHaveLength(0);
    expect(audit).toHaveLength(1);
    expect(dealerFor("DLR-OB3")?.currentBalance.toFixed(2)).toBe("0.00");
  });

  it("rejects a non-zero previousBalance — opening balance must be the dealer's first posting", async () => {
    const { tx } = makeStubTx({
      dealers: [{ dealerCode: "DLR-OB4", currentBalance: new Prisma.Decimal("42.00") }],
    });

    await expect(
      postOpeningBalance({
        tx: tx as Prisma.TransactionClient,
        dealerCode: "DLR-OB4",
        amount: new Prisma.Decimal("100.00"),
        previousBalance: new Prisma.Decimal("42.00"),
        userId: "user-1",
        effectiveDate: new Date(),
        referenceNo: "OB-DLR-OB4",
        openingBalanceId: "ob-4",
      }),
    ).rejects.toThrow(RangeError);
  });

  it("never silently double-applies: a stale second call with previousBalance=0 fails loudly instead of duplicating the balance", async () => {
    // Real idempotent replay protection lives at the workflow layer
    // (`postOpeningBalanceRecord` short-circuits on an already-Locked record —
    // see `opening-balance.test.ts`). At the posting-service boundary, calling
    // this twice with a stale `previousBalance` must never silently apply the
    // amount a second time; the balance-parity assertion must catch it.
    const { tx, ledger } = makeStubTx({
      dealers: [{ dealerCode: "DLR-OB5", currentBalance: new Prisma.Decimal("0.00") }],
    });

    const input = {
      tx: tx as Prisma.TransactionClient,
      dealerCode: "DLR-OB5",
      amount: new Prisma.Decimal("777.00"),
      previousBalance: new Prisma.Decimal("0.00"),
      userId: "user-1",
      effectiveDate: new Date(),
      referenceNo: "OB-DLR-OB5",
      openingBalanceId: "ob-5",
    };

    await postOpeningBalance(input);
    await expect(postOpeningBalance(input)).rejects.toThrow(/mismatch/);

    expect(ledger).toHaveLength(1);
  });
});

describe("LedgerBalanceMismatchError export", () => {
  // Sanity check — mismatch class is exported for callers to catch (or to be
  // matched in higher-level failure paths).
  it("is constructible and carries dealer + amounts", () => {
    const err = new LedgerBalanceMismatchError("DLR-9", "100.00", "50.00");
    expect(err.code).toBe("LEDGER_BALANCE_MISMATCH");
    expect(err.dealerCode).toBe("DLR-9");
    expect(err.ledgerBalance).toBe("100.00");
    expect(err.cachedBalance).toBe("50.00");
  });
});
