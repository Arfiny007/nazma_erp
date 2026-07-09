import { describe, expect, it } from "vitest";
import {
  FinancialReferenceType,
  LedgerPostingType,
  Prisma,
} from "@prisma/client";

import {
  buildLedgerEntryCreateData,
  buildReversalPosting,
} from "@/lib/ledger/ledger-posting";
import type { LedgerPostingInput } from "@/lib/ledger/ledger-types";
import {
  buildOpeningBalancePosting,
  buildOpeningBalancePostingKey,
} from "@/lib/ledger/opening-balance";

const tx = {} as LedgerPostingInput["tx"];
const ZERO = new Prisma.Decimal(0);

describe("buildLedgerEntryCreateData", () => {
  it("derives postingKey from descriptor when absent", () => {
    const row = buildLedgerEntryCreateData({
      tx,
      dealerCode: "DLR-1",
      transactionDate: new Date("2026-07-01"),
      referenceType: FinancialReferenceType.Invoice,
      referenceId: "inv-1",
      referenceNo: "INV-1",
      postingType: LedgerPostingType.Issue,
      debit: new Prisma.Decimal("1000.00"),
      credit: ZERO,
      previousBalance: new Prisma.Decimal("200.00"),
    });

    expect(row.postingKey).toBe("ledger:Invoice:inv-1:Issue");
    expect(row.balance.toString()).toBe("1200");
  });

  it("respects explicit postingKey overrides", () => {
    const row = buildLedgerEntryCreateData({
      tx,
      dealerCode: "DLR-1",
      transactionDate: new Date("2026-07-01"),
      referenceType: FinancialReferenceType.Invoice,
      referenceId: "inv-1",
      referenceNo: "INV-1",
      postingType: LedgerPostingType.Issue,
      postingKey: "custom-key",
      debit: new Prisma.Decimal("500.00"),
      credit: ZERO,
      previousBalance: ZERO,
    });

    expect(row.postingKey).toBe("custom-key");
  });

  it("defaults nullable fields", () => {
    const row = buildLedgerEntryCreateData({
      tx,
      dealerCode: "DLR-1",
      transactionDate: new Date("2026-07-01"),
      referenceType: FinancialReferenceType.Invoice,
      referenceId: "inv-1",
      referenceNo: "INV-1",
      postingType: LedgerPostingType.Issue,
      debit: new Prisma.Decimal("100.00"),
      credit: ZERO,
      previousBalance: ZERO,
    });

    expect(row.reversesEntryId).toBeNull();
    expect(row.createdById).toBeNull();
    expect(row.remarks).toBeNull();
  });
});

describe("buildReversalPosting", () => {
  it("swaps debit and credit sides", () => {
    const reversal = buildReversalPosting({
      tx,
      originalEntry: {
        id: "entry-1",
        dealerCode: "DLR-1",
        referenceType: FinancialReferenceType.Invoice,
        referenceId: "inv-1",
        referenceNo: "INV-1",
        debit: new Prisma.Decimal("1000.00"),
        credit: ZERO,
      },
      previousBalance: new Prisma.Decimal("1000.00"),
      transactionDate: new Date("2026-07-05"),
    });

    expect(reversal.debit.toString()).toBe("0");
    expect(reversal.credit.toString()).toBe("1000");
    expect(reversal.postingType).toBe(LedgerPostingType.Reversal);
    expect(reversal.postingKey).toBe("ledger:Invoice:inv-1:Reversal");
    expect(reversal.reversesEntryId).toBe("entry-1");
  });

  it("supports sequence suffix for chained reversals", () => {
    const reversal = buildReversalPosting({
      tx,
      originalEntry: {
        id: "entry-2",
        dealerCode: "DLR-1",
        referenceType: FinancialReferenceType.Collection,
        referenceId: "col-1",
        referenceNo: "COL-1",
        debit: ZERO,
        credit: new Prisma.Decimal("500.00"),
      },
      previousBalance: new Prisma.Decimal("-500.00"),
      transactionDate: new Date("2026-07-05"),
      sequence: 1,
    });

    expect(reversal.postingKey).toBe("ledger:Collection:col-1:Reversal:1");
  });
});

describe("buildOpeningBalancePosting", () => {
  it("emits debit for positive opening balance", () => {
    const input = buildOpeningBalancePosting({
      tx,
      previousBalance: ZERO,
      input: {
        dealerCode: "DLR-1",
        amount: new Prisma.Decimal("25000.00"),
        effectiveDate: new Date("2026-01-01"),
        referenceNo: "OB-2026-01-DLR-1",
      },
    });

    expect(input.debit.toString()).toBe("25000");
    expect(input.credit.toString()).toBe("0");
    expect(input.postingType).toBe(LedgerPostingType.OpeningBalance);
    expect(input.postingKey).toBe(buildOpeningBalancePostingKey("DLR-1"));
  });

  it("emits credit for negative (advance) opening balance", () => {
    const input = buildOpeningBalancePosting({
      tx,
      previousBalance: ZERO,
      input: {
        dealerCode: "DLR-2",
        amount: new Prisma.Decimal("-5000.00"),
        effectiveDate: new Date("2026-01-01"),
        referenceNo: "OB-2026-01-DLR-2",
      },
    });

    expect(input.debit.toString()).toBe("0");
    expect(input.credit.toString()).toBe("5000");
  });

  it("rejects a zero opening amount", () => {
    expect(() =>
      buildOpeningBalancePosting({
        tx,
        previousBalance: ZERO,
        input: {
          dealerCode: "DLR-3",
          amount: ZERO,
          effectiveDate: new Date("2026-01-01"),
          referenceNo: "OB-2026-01-DLR-3",
        },
      }),
    ).toThrow();
  });

  it("rejects non-zero previousBalance", () => {
    expect(() =>
      buildOpeningBalancePosting({
        tx,
        previousBalance: new Prisma.Decimal("100.00"),
        input: {
          dealerCode: "DLR-4",
          amount: new Prisma.Decimal("500.00"),
          effectiveDate: new Date("2026-01-01"),
          referenceNo: "OB-2026-01-DLR-4",
        },
      }),
    ).toThrow();
  });
});
