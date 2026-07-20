import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  ZERO,
  buildDealerFinancials,
  calculateBalanceDue,
  calculateNetBalance,
  calculateReconciliationDelta,
  classifyPeriodEntry,
  normalizeAggregate,
} from "./sr-performance-calculations";

function d(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

describe("sr-performance-calculations", () => {
  it("zero opening, zero movement", () => {
    expect(calculateBalanceDue(ZERO, ZERO, ZERO).toFixed(2)).toBe("0.00");
  });

  it("positive previous due", () => {
    expect(calculateBalanceDue(d("1000.00"), ZERO, ZERO).toFixed(2)).toBe(
      "1000.00",
    );
  });

  it("negative previous due / dealer advance", () => {
    expect(calculateBalanceDue(d("-250.50"), ZERO, ZERO).toFixed(2)).toBe(
      "-250.50",
    );
  });

  it("sales only", () => {
    expect(calculateBalanceDue(ZERO, d("500.00"), ZERO).toFixed(2)).toBe(
      "500.00",
    );
  });

  it("collection only", () => {
    expect(calculateBalanceDue(ZERO, ZERO, d("300.00")).toFixed(2)).toBe(
      "-300.00",
    );
  });

  it("sales and collection", () => {
    expect(
      calculateBalanceDue(d("100.00"), d("200.00"), d("50.00")).toFixed(2),
    ).toBe("250.00");
  });

  it("partial collection", () => {
    expect(
      calculateNetBalance(d("1000.00"), d("500.00"), d("200.00")).toFixed(2),
    ).toBe("1300.00");
  });

  it("collection greater than sales", () => {
    expect(
      calculateBalanceDue(d("100.00"), d("50.00"), d("200.00")).toFixed(2),
    ).toBe("-50.00");
  });

  it("collection reversal reduces collection", () => {
    const reversal = classifyPeriodEntry({
      postingType: "Reversal",
      referenceType: "Collection",
      debit: d("100.00"),
      credit: ZERO,
    });
    expect(reversal.collection.toFixed(2)).toBe("-100.00");
    expect(reversal.isUnsupported).toBe(false);
  });

  it("large Decimal(18,2) values", () => {
    const previousDue = d("99999999999999.99");
    const sales = d("1.01");
    const collection = d("0.00");
    expect(calculateBalanceDue(previousDue, sales, collection).toFixed(2)).toBe(
      "100000000000001.00",
    );
  });

  it("two-decimal precision", () => {
    expect(
      calculateBalanceDue(d("10.10"), d("0.20"), d("0.05")).toFixed(2),
    ).toBe("10.25");
  });

  it("null aggregate normalization", () => {
    expect(normalizeAggregate(null).toFixed(2)).toBe("0.00");
    expect(normalizeAggregate(undefined).toFixed(2)).toBe("0.00");
  });

  it("unsupported posting reconciliation delta", () => {
    const previousDue = d("100.00");
    const sales = ZERO;
    const collection = ZERO;
    const ledgerMovement = d("25.00"); // e.g. DebitNote
    const balanceDue = calculateBalanceDue(previousDue, sales, collection);
    const delta = calculateReconciliationDelta(
      previousDue,
      ledgerMovement,
      balanceDue,
    );
    expect(balanceDue.toFixed(2)).toBe("100.00");
    expect(delta.toFixed(2)).toBe("25.00");
  });

  it("buildDealerFinancials formula parity", () => {
    const result = buildDealerFinancials({
      previousDue: d("100.00"),
      sales: d("50.00"),
      collection: d("20.00"),
      ledgerMovement: d("30.00"),
      unsupportedPostingCount: 0,
    });
    expect(result.balanceDue.toFixed(2)).toBe("130.00");
    expect(result.reconciliationDelta.toFixed(2)).toBe("0.00");
  });

  it("Issue contributes sales; Collection contributes collection", () => {
    const issue = classifyPeriodEntry({
      postingType: "Issue",
      referenceType: "Invoice",
      debit: d("200.00"),
      credit: ZERO,
    });
    const collection = classifyPeriodEntry({
      postingType: "Collection",
      referenceType: "Collection",
      debit: ZERO,
      credit: d("80.00"),
    });
    expect(issue.sales.toFixed(2)).toBe("200.00");
    expect(collection.collection.toFixed(2)).toBe("80.00");
  });

  it("CreditNote is unsupported for Sales/Collection columns", () => {
    const entry = classifyPeriodEntry({
      postingType: "CreditNote",
      referenceType: "CreditNote",
      debit: ZERO,
      credit: d("15.00"),
    });
    expect(entry.isUnsupported).toBe(true);
    expect(entry.sales.toFixed(2)).toBe("0.00");
    expect(entry.collection.toFixed(2)).toBe("0.00");
  });
});
