import { describe, expect, it } from "vitest";
import {
  FinancialReferenceType,
  LedgerPostingType,
  Prisma,
} from "@prisma/client";

import {
  DealerNotFoundError,
  getDealerStatement,
  getDealerStatementSummary,
  InvalidDateRangeError,
  InvalidPaginationError,
} from "@/lib/ledger/statement";
import type { StatementReadClient } from "@/lib/ledger/statement/statement-query";

/**
 * Unit tests for the PHASE_07D1 Dealer Statement read engine.
 *
 * In-memory Prisma stub — no live PostgreSQL required. Every scenario
 * exercises `getDealerStatement()` / `getDealerStatementSummary()` against
 * synthetic `LedgerEntry` rows whose `balance` field is authoritative (never
 * recomputed by the service under test).
 */

interface StubDealer {
  dealerCode: string;
  companyName: string;
  currentBalance: Prisma.Decimal;
  creditLimit: Prisma.Decimal;
}

interface StubOpeningBalance {
  dealerCode: string;
  amount: Prisma.Decimal;
  effectiveDate: Date;
  status: string;
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
  createdById: string | null;
  createdByName: string | null;
  remarks: string | null;
}

function d(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function sortLedgerEntries(
  rows: StubLedgerEntry[],
  orderBy: Array<
    | { transactionDate: "asc" | "desc" }
    | { postingDate: "asc" | "desc" }
    | { id: "asc" | "desc" }
  >,
): StubLedgerEntry[] {
  return [...rows].sort((a, b) => {
    for (const clause of orderBy) {
      if ("transactionDate" in clause) {
        const dir = clause.transactionDate === "desc" ? -1 : 1;
        const cmp = a.transactionDate.getTime() - b.transactionDate.getTime();
        if (cmp !== 0) return cmp * dir;
      }
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

function matchesDateFilter(
  date: Date,
  filter?: { gte?: Date; lte?: Date },
): boolean {
  if (!filter) return true;
  if (filter.gte && date.getTime() < filter.gte.getTime()) return false;
  if (filter.lte && date.getTime() > filter.lte.getTime()) return false;
  return true;
}

function makeStatementStub(options: {
  dealers: StubDealer[];
  ledger?: StubLedgerEntry[];
  openingBalances?: StubOpeningBalance[];
}): StatementReadClient {
  const dealers = new Map(
    options.dealers.map((row) => [row.dealerCode, { ...row }] as const),
  );
  const ledger = [...(options.ledger ?? [])];
  const openingBalances = new Map(
    (options.openingBalances ?? []).map((row) => [row.dealerCode, row] as const),
  );

  return {
    dealer: {
      findUnique: async ({
        where,
        select,
      }: {
        where: { dealerCode: string };
        select: Record<string, boolean>;
      }) => {
        const row = dealers.get(where.dealerCode);
        if (!row) return null;
        const result: Record<string, unknown> = {};
        if (select.dealerCode) result.dealerCode = row.dealerCode;
        if (select.companyName) result.companyName = row.companyName;
        if (select.currentBalance) result.currentBalance = row.currentBalance;
        if (select.creditLimit) result.creditLimit = row.creditLimit;
        return result;
      },
    },
    openingBalance: {
      findUnique: async ({
        where,
        select,
      }: {
        where: { dealerCode: string };
        select: Record<string, boolean>;
      }) => {
        const row = openingBalances.get(where.dealerCode);
        if (!row) return null;
        const result: Record<string, unknown> = {};
        if (select.amount) result.amount = row.amount;
        if (select.effectiveDate) result.effectiveDate = row.effectiveDate;
        if (select.status) result.status = row.status;
        return result;
      },
    },
    ledgerEntry: {
      count: async ({
        where,
      }: {
        where: {
          dealerCode: string;
          transactionDate?: { gte?: Date; lte?: Date; lt?: Date };
        };
      }) => {
        return ledger.filter((row) => {
          if (row.dealerCode !== where.dealerCode) return false;
          if (where.transactionDate?.lt) {
            return row.transactionDate.getTime() < where.transactionDate.lt.getTime();
          }
          return matchesDateFilter(row.transactionDate, where.transactionDate);
        }).length;
      },
      findMany: async ({
        where,
        orderBy,
        skip,
        take,
        include,
        select,
      }: {
        where: {
          dealerCode: string;
          transactionDate?: { gte?: Date; lte?: Date; lt?: Date };
        };
        orderBy?: Array<
          | { transactionDate: "asc" | "desc" }
          | { postingDate: "asc" | "desc" }
          | { id: "asc" | "desc" }
        >;
        skip?: number;
        take?: number;
        include?: { createdBy: { select: { name: true } } };
        select?: { debit: true; credit: true; balance: true };
      }) => {
        let rows = ledger.filter((row) => {
          if (row.dealerCode !== where.dealerCode) return false;
          if (where.transactionDate?.lt) {
            return row.transactionDate.getTime() < where.transactionDate.lt.getTime();
          }
          return matchesDateFilter(row.transactionDate, where.transactionDate);
        });

        if (orderBy) {
          rows = sortLedgerEntries(rows, orderBy);
        }

        if (typeof skip === "number" || typeof take === "number") {
          const start = skip ?? 0;
          const end = typeof take === "number" ? start + take : undefined;
          rows = rows.slice(start, end);
        }

        if (select) {
          return rows.map((row) => ({
            debit: row.debit,
            credit: row.credit,
            balance: row.balance,
          }));
        }

        return rows.map((row) => ({
          id: row.id,
          transactionDate: row.transactionDate,
          postingDate: row.postingDate,
          referenceType: row.referenceType,
          referenceId: row.referenceId,
          referenceNo: row.referenceNo,
          postingType: row.postingType,
          debit: row.debit,
          credit: row.credit,
          balance: row.balance,
          createdById: row.createdById,
          remarks: row.remarks,
          createdBy: include?.createdBy
            ? { name: row.createdByName }
            : undefined,
        }));
      },
      aggregate: async ({
        where,
        _sum,
      }: {
        where: {
          dealerCode: string;
          transactionDate?: { gte?: Date; lte?: Date };
        };
        _sum: { debit: true; credit: true };
      }) => {
        void _sum;
        const rows = ledger.filter(
          (row) =>
            row.dealerCode === where.dealerCode &&
            matchesDateFilter(row.transactionDate, where.transactionDate),
        );
        return {
          _sum: {
            debit: rows.reduce((acc, row) => acc.plus(row.debit), d("0")),
            credit: rows.reduce((acc, row) => acc.plus(row.credit), d("0")),
          },
        };
      },
      findFirst: async ({
        where,
        orderBy,
        select,
      }: {
        where: {
          dealerCode: string;
          transactionDate?: { gte?: Date; lte?: Date; lt?: Date };
        };
        orderBy: Array<
          | { transactionDate: "asc" | "desc" }
          | { postingDate: "asc" | "desc" }
          | { id: "asc" | "desc" }
        >;
        select?: { balance: true; transactionDate: true };
      }) => {
        const rows = sortLedgerEntries(
          ledger.filter((row) => {
            if (row.dealerCode !== where.dealerCode) return false;
            if (where.transactionDate?.lt) {
              return row.transactionDate.getTime() < where.transactionDate.lt.getTime();
            }
            return matchesDateFilter(row.transactionDate, where.transactionDate);
          }),
          orderBy,
        );
        const first = rows[0];
        if (!first) return null;
        if (select?.balance && select.transactionDate) {
          return {
            balance: first.balance,
            transactionDate: first.transactionDate,
          };
        }
        if (select?.balance) {
          return { balance: first.balance };
        }
        if (select?.transactionDate) {
          return { transactionDate: first.transactionDate };
        }
        return first;
      },
    },
  } as unknown as StatementReadClient;
}

const DEALER_CODE = "DLR-001";
const DEALER: StubDealer = {
  dealerCode: DEALER_CODE,
  companyName: "Test Dealer Ltd",
  currentBalance: d("7500.00"),
  creditLimit: d("100000.00"),
};

const DAY1 = new Date("2026-01-01T00:00:00.000Z");
const DAY2 = new Date("2026-02-01T00:00:00.000Z");
const DAY3 = new Date("2026-03-01T00:00:00.000Z");
const DAY4 = new Date("2026-04-01T00:00:00.000Z");

const OPENING_ENTRY: StubLedgerEntry = {
  id: "le-ob",
  dealerCode: DEALER_CODE,
  transactionDate: DAY1,
  postingDate: DAY1,
  referenceType: FinancialReferenceType.OpeningBalance,
  referenceId: "OB-DLR-001",
  referenceNo: "OB-DLR-001",
  postingType: LedgerPostingType.OpeningBalance,
  postingKey: "ledger:OpeningBalance:OB-DLR-001:OpeningBalance",
  debit: d("5000.00"),
  credit: d("0.00"),
  balance: d("5000.00"),
  createdById: "user-1",
  createdByName: "Accounts User",
  remarks: null,
};

const INVOICE_ENTRY: StubLedgerEntry = {
  id: "le-inv",
  dealerCode: DEALER_CODE,
  transactionDate: DAY2,
  postingDate: DAY2,
  referenceType: FinancialReferenceType.Invoice,
  referenceId: "inv-1",
  referenceNo: "INV-000001",
  postingType: LedgerPostingType.Issue,
  postingKey: "ledger:Invoice:inv-1:Issue",
  debit: d("3000.00"),
  credit: d("0.00"),
  balance: d("8000.00"),
  createdById: "user-1",
  createdByName: "Accounts User",
  remarks: null,
};

const COLLECTION_ENTRY: StubLedgerEntry = {
  id: "le-col",
  dealerCode: DEALER_CODE,
  transactionDate: DAY3,
  postingDate: DAY3,
  referenceType: FinancialReferenceType.Collection,
  referenceId: "col-1",
  referenceNo: "COL-000001",
  postingType: LedgerPostingType.Collection,
  postingKey: "ledger:Collection:col-1:Collection",
  debit: d("0.00"),
  credit: d("500.00"),
  balance: d("7500.00"),
  createdById: "user-1",
  createdByName: "Accounts User",
  remarks: null,
};

describe("getDealerStatement", () => {
  it("returns opening balance as the first ledger row for an initialized dealer", async () => {
    const client = makeStatementStub({
      dealers: [{ ...DEALER, currentBalance: d("5000.00") }],
      ledger: [OPENING_ENTRY],
      openingBalances: [
        {
          dealerCode: DEALER_CODE,
          amount: d("5000.00"),
          effectiveDate: DAY1,
          status: "Locked",
        },
      ],
    });

    const result = await getDealerStatement(
      { dealerCode: DEALER_CODE, page: 1, pageSize: 50 },
      client,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.postingType).toBe("OpeningBalance");
    expect(result.rows[0]?.isOpeningBalance).toBe(true);
    expect(result.rows[0]?.runningBalance.toFixed(2)).toBe("5000.00");
    expect(result.meta.hasOpeningBalance).toBe(true);
    expect(result.meta.openingBalanceAmount?.toFixed(2)).toBe("5000.00");
    expect(result.meta.ledgerIntegrity.isConsistent).toBe(true);
  });

  it("handles a dealer without an opening balance record", async () => {
    const client = makeStatementStub({
      dealers: [DEALER],
      ledger: [INVOICE_ENTRY, COLLECTION_ENTRY],
    });

    const result = await getDealerStatement(
      { dealerCode: DEALER_CODE, page: 1, pageSize: 50 },
      client,
    );

    expect(result.meta.hasOpeningBalance).toBe(false);
    expect(result.meta.openingBalanceAmount).toBeNull();
    expect(result.rows.some((row) => row.postingType === "OpeningBalance")).toBe(
      false,
    );
  });

  it("maps invoice issue rows from LedgerEntry", async () => {
    const client = makeStatementStub({
      dealers: [DEALER],
      ledger: [OPENING_ENTRY, INVOICE_ENTRY, COLLECTION_ENTRY],
    });

    const result = await getDealerStatement(
      { dealerCode: DEALER_CODE, page: 1, pageSize: 50 },
      client,
    );

    const invoiceRow = result.rows.find((row) => row.postingType === "Issue");
    expect(invoiceRow).toBeDefined();
    expect(invoiceRow?.referenceType).toBe("Invoice");
    expect(invoiceRow?.referenceNo).toBe("INV-000001");
    expect(invoiceRow?.debit.toFixed(2)).toBe("3000.00");
    expect(invoiceRow?.description).toContain("INV-000001");
  });

  it("maps collection rows from LedgerEntry", async () => {
    const client = makeStatementStub({
      dealers: [DEALER],
      ledger: [OPENING_ENTRY, INVOICE_ENTRY, COLLECTION_ENTRY],
    });

    const result = await getDealerStatement(
      { dealerCode: DEALER_CODE, page: 1, pageSize: 50 },
      client,
    );

    const collectionRow = result.rows.find(
      (row) => row.postingType === "Collection",
    );
    expect(collectionRow).toBeDefined();
    expect(collectionRow?.referenceType).toBe("Collection");
    expect(collectionRow?.credit.toFixed(2)).toBe("500.00");
    expect(collectionRow?.runningBalance.toFixed(2)).toBe("7500.00");
  });

  it("exposes running balance verbatim from LedgerEntry.balance — never recomputed", async () => {
    const driftedReplayEntry: StubLedgerEntry = {
      ...COLLECTION_ENTRY,
      balance: d("9999.99"),
    };
    const client = makeStatementStub({
      dealers: [{ ...DEALER, currentBalance: d("9999.99") }],
      ledger: [OPENING_ENTRY, INVOICE_ENTRY, driftedReplayEntry],
    });

    const result = await getDealerStatement(
      { dealerCode: DEALER_CODE, page: 1, pageSize: 50 },
      client,
    );

    expect(result.rows.at(-1)?.runningBalance.toFixed(2)).toBe("9999.99");
    expect(result.meta.ledgerIntegrity.isCacheValid).toBe(true);
  });

  it("filters rows by inclusive transactionDate range", async () => {
    const client = makeStatementStub({
      dealers: [DEALER],
      ledger: [OPENING_ENTRY, INVOICE_ENTRY, COLLECTION_ENTRY],
    });

    const result = await getDealerStatement(
      {
        dealerCode: DEALER_CODE,
        fromDate: DAY2,
        toDate: DAY3,
        page: 1,
        pageSize: 50,
      },
      client,
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.referenceNo)).toEqual([
      "INV-000001",
      "COL-000001",
    ]);
    expect(result.openingBalanceForRange.toFixed(2)).toBe("5000.00");
    expect(result.totals.entryCount).toBe(2);
    expect(result.totals.totalDebit.toFixed(2)).toBe("3000.00");
    expect(result.totals.totalCredit.toFixed(2)).toBe("500.00");
  });

  it("paginates ledger rows", async () => {
    const extraEntry: StubLedgerEntry = {
      id: "le-inv-2",
      dealerCode: DEALER_CODE,
      transactionDate: DAY4,
      postingDate: DAY4,
      referenceType: FinancialReferenceType.Invoice,
      referenceId: "inv-2",
      referenceNo: "INV-000002",
      postingType: LedgerPostingType.Issue,
      postingKey: "ledger:Invoice:inv-2:Issue",
      debit: d("1000.00"),
      credit: d("0.00"),
      balance: d("8500.00"),
      createdById: null,
      createdByName: null,
      remarks: null,
    };

    const client = makeStatementStub({
      dealers: [{ ...DEALER, currentBalance: d("8500.00") }],
      ledger: [OPENING_ENTRY, INVOICE_ENTRY, COLLECTION_ENTRY, extraEntry],
    });

    const page1 = await getDealerStatement(
      { dealerCode: DEALER_CODE, page: 1, pageSize: 2 },
      client,
    );
    const page2 = await getDealerStatement(
      { dealerCode: DEALER_CODE, page: 2, pageSize: 2 },
      client,
    );

    expect(page1.pagination.total).toBe(4);
    expect(page1.pagination.pageCount).toBe(2);
    expect(page1.rows).toHaveLength(2);
    expect(page2.rows).toHaveLength(2);
    expect(page1.rows[0]?.referenceNo).toBe("OB-DLR-001");
    expect(page2.rows[0]?.referenceNo).toBe("COL-000001");
  });

  it("returns an empty statement for a future dealer with no ledger activity", async () => {
    const client = makeStatementStub({
      dealers: [
        {
          dealerCode: "DLR-FUTURE",
          companyName: "Future Dealer",
          currentBalance: d("0.00"),
          creditLimit: d("50000.00"),
        },
      ],
      ledger: [],
    });

    const result = await getDealerStatement(
      { dealerCode: "DLR-FUTURE", page: 1, pageSize: 50 },
      client,
    );

    expect(result.rows).toHaveLength(0);
    expect(result.totals.entryCount).toBe(0);
    expect(result.totals.totalDebit.toFixed(2)).toBe("0.00");
    expect(result.totals.totalCredit.toFixed(2)).toBe("0.00");
    expect(result.meta.hasOpeningBalance).toBe(false);
    expect(result.meta.ledgerIntegrity.isConsistent).toBe(true);
  });

  it("computes totals across the full filtered range, not just the current page", async () => {
    const client = makeStatementStub({
      dealers: [DEALER],
      ledger: [OPENING_ENTRY, INVOICE_ENTRY, COLLECTION_ENTRY],
    });

    const result = await getDealerStatement(
      { dealerCode: DEALER_CODE, page: 1, pageSize: 1 },
      client,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.totals.entryCount).toBe(3);
    expect(result.totals.totalDebit.toFixed(2)).toBe("8000.00");
    expect(result.totals.totalCredit.toFixed(2)).toBe("500.00");
    expect(result.totals.netMovement.toFixed(2)).toBe("7500.00");
  });

  it("throws DealerNotFoundError for an unknown dealer", async () => {
    const client = makeStatementStub({ dealers: [DEALER], ledger: [] });

    await expect(
      getDealerStatement(
        { dealerCode: "MISSING", page: 1, pageSize: 50 },
        client,
      ),
    ).rejects.toBeInstanceOf(DealerNotFoundError);
  });

  it("throws InvalidDateRangeError when fromDate is after toDate", async () => {
    const client = makeStatementStub({ dealers: [DEALER], ledger: [] });

    await expect(
      getDealerStatement(
        {
          dealerCode: DEALER_CODE,
          fromDate: DAY3,
          toDate: DAY2,
          page: 1,
          pageSize: 50,
        },
        client,
      ),
    ).rejects.toBeInstanceOf(InvalidDateRangeError);
  });

  it("throws InvalidPaginationError for invalid page bounds", async () => {
    const client = makeStatementStub({ dealers: [DEALER], ledger: [] });

    await expect(
      getDealerStatement(
        { dealerCode: DEALER_CODE, page: 0, pageSize: 50 },
        client,
      ),
    ).rejects.toBeInstanceOf(InvalidPaginationError);
  });
});

describe("getDealerStatementSummary", () => {
  it("returns compact totals and date bounds", async () => {
    const client = makeStatementStub({
      dealers: [DEALER],
      ledger: [OPENING_ENTRY, INVOICE_ENTRY, COLLECTION_ENTRY],
      openingBalances: [
        {
          dealerCode: DEALER_CODE,
          amount: d("5000.00"),
          effectiveDate: DAY1,
          status: "Locked",
        },
      ],
    });

    const summary = await getDealerStatementSummary(
      { dealerCode: DEALER_CODE },
      client,
    );

    expect(summary.entryCount).toBe(3);
    expect(summary.totalDebit.toFixed(2)).toBe("8000.00");
    expect(summary.totalCredit.toFixed(2)).toBe("500.00");
    expect(summary.firstEntryDate?.toISOString()).toBe(DAY1.toISOString());
    expect(summary.lastEntryDate?.toISOString()).toBe(DAY3.toISOString());
    expect(summary.hasOpeningBalance).toBe(true);
  });
});
