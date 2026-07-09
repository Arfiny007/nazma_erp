import { describe, expect, it } from "vitest";
import {
  FinancialReferenceType,
  LedgerPostingType,
  Prisma,
} from "@prisma/client";

import { LedgerPostingValidationError } from "@/lib/ledger/ledger-errors";
import type { LedgerPostingInput } from "@/lib/ledger/ledger-types";
import {
  applyPostingToBalance,
  assertLedgerAppendOnly,
  assertLedgerPostingInputValid,
} from "@/lib/ledger/ledger-validation";

const dummyTx = {} as LedgerPostingInput["tx"];
const ZERO = new Prisma.Decimal(0);

function baseInput(overrides: Partial<LedgerPostingInput> = {}): LedgerPostingInput {
  return {
    tx: dummyTx,
    dealerCode: "DLR-1",
    transactionDate: new Date("2026-07-01T00:00:00Z"),
    referenceType: FinancialReferenceType.Invoice,
    referenceId: "inv-1",
    referenceNo: "INV-000001",
    postingType: LedgerPostingType.Issue,
    debit: new Prisma.Decimal("1000.00"),
    credit: ZERO,
    previousBalance: new Prisma.Decimal("500.00"),
    ...overrides,
  };
}

describe("assertLedgerPostingInputValid", () => {
  it("accepts a valid debit-only posting", () => {
    expect(() => assertLedgerPostingInputValid(baseInput())).not.toThrow();
  });

  it("accepts a valid credit-only posting", () => {
    expect(() =>
      assertLedgerPostingInputValid(
        baseInput({
          debit: ZERO,
          credit: new Prisma.Decimal("2500.00"),
          postingType: LedgerPostingType.Collection,
        }),
      ),
    ).not.toThrow();
  });

  it("rejects both debit and credit positive", () => {
    expect(() =>
      assertLedgerPostingInputValid(
        baseInput({
          debit: new Prisma.Decimal("500.00"),
          credit: new Prisma.Decimal("500.00"),
        }),
      ),
    ).toThrow(LedgerPostingValidationError);
  });

  it("rejects both debit and credit zero", () => {
    expect(() =>
      assertLedgerPostingInputValid(
        baseInput({ debit: ZERO, credit: ZERO }),
      ),
    ).toThrow(LedgerPostingValidationError);
  });

  it("rejects negative debit", () => {
    expect(() =>
      assertLedgerPostingInputValid(
        baseInput({ debit: new Prisma.Decimal("-1.00") }),
      ),
    ).toThrow(LedgerPostingValidationError);
  });

  it("rejects empty dealerCode", () => {
    expect(() =>
      assertLedgerPostingInputValid(baseInput({ dealerCode: "" })),
    ).toThrow(LedgerPostingValidationError);
  });

  it("rejects empty referenceNo", () => {
    expect(() =>
      assertLedgerPostingInputValid(baseInput({ referenceNo: "" })),
    ).toThrow(LedgerPostingValidationError);
  });

  it("rejects invalid transactionDate", () => {
    expect(() =>
      assertLedgerPostingInputValid(
        baseInput({ transactionDate: new Date("not-a-date") }),
      ),
    ).toThrow(LedgerPostingValidationError);
  });

  it("rejects blank explicit postingKey", () => {
    expect(() =>
      assertLedgerPostingInputValid(baseInput({ postingKey: "   " })),
    ).toThrow(LedgerPostingValidationError);
  });
});

describe("applyPostingToBalance", () => {
  it("adds debit and subtracts credit", () => {
    expect(
      applyPostingToBalance(
        new Prisma.Decimal("100.00"),
        new Prisma.Decimal("50.00"),
        ZERO,
      ).toFixed(2),
    ).toBe("150.00");
  });

  it("carries advance credit into negative balance", () => {
    expect(
      applyPostingToBalance(
        new Prisma.Decimal("100.00"),
        ZERO,
        new Prisma.Decimal("500.00"),
      ).toFixed(2),
    ).toBe("-400.00");
  });

  it("preserves signed previousBalance", () => {
    expect(
      applyPostingToBalance(
        new Prisma.Decimal("-200.00"),
        new Prisma.Decimal("300.00"),
        ZERO,
      ).toFixed(2),
    ).toBe("100.00");
  });
});

describe("assertLedgerAppendOnly", () => {
  it("throws for update", () => {
    expect(() => assertLedgerAppendOnly("update", "abc")).toThrow(
      LedgerPostingValidationError,
    );
  });

  it("throws for delete", () => {
    expect(() => assertLedgerAppendOnly("delete", "abc")).toThrow(
      LedgerPostingValidationError,
    );
  });
});
