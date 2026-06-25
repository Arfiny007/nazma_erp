import { describe, expect, it } from "vitest";
import { DeliveryChallanStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

import {
  assertChallanConfirmedForInvoice,
  assertChallanHasItemsForInvoice,
  assertNoExistingInvoice,
  InvoiceWorkflowError,
} from "@/lib/invoices/workflow";
import {
  allocateProportionalDiscount,
  buildInvoiceFromChallanLines,
} from "@/lib/utils/invoice-calculator";
import { wouldExceedCreditLimit } from "@/lib/utils/credit-limit";

describe("invoice workflow guards", () => {
  it("blocks Draft challans", () => {
    expect(() =>
      assertChallanConfirmedForInvoice(DeliveryChallanStatus.Draft),
    ).toThrow(InvoiceWorkflowError);
  });

  it("blocks Cancelled challans", () => {
    expect(() =>
      assertChallanConfirmedForInvoice(DeliveryChallanStatus.Cancelled),
    ).toThrow(InvoiceWorkflowError);
  });

  it("allows Confirmed challans", () => {
    expect(() =>
      assertChallanConfirmedForInvoice(DeliveryChallanStatus.Confirmed),
    ).not.toThrow();
  });

  it("blocks duplicate invoice", () => {
    expect(() => assertNoExistingInvoice(true)).toThrow(InvoiceWorkflowError);
  });

  it("blocks empty challan", () => {
    expect(() => assertChallanHasItemsForInvoice(0)).toThrow(
      InvoiceWorkflowError,
    );
  });
});

describe("invoice calculator", () => {
  it("allocates proportional discount from order line", () => {
    const discount = allocateProportionalDiscount(
      new Prisma.Decimal("100.00"),
      new Prisma.Decimal("50.00"),
      new Prisma.Decimal("100.00"),
    );
    expect(discount.toFixed(2)).toBe("50.00");
  });

  it("builds totals from challan quantities only", () => {
    const { snapshots, totals } = buildInvoiceFromChallanLines([
      {
        challanItemId: "c1",
        orderItemId: "o1",
        productId: "p1",
        productCode: "SKU-1",
        productName: "Tap",
        unit: "PCS",
        challanQuantity: new Prisma.Decimal("10.00"),
        orderItemQuantity: new Prisma.Decimal("20.00"),
        orderItemUnitPrice: new Prisma.Decimal("100.00"),
        orderItemDiscount: new Prisma.Decimal("20.00"),
      },
    ]);

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].quantity.toFixed(2)).toBe("10.00");
    expect(snapshots[0].discount.toFixed(2)).toBe("10.00");
    expect(snapshots[0].lineTotal.toFixed(2)).toBe("990.00");
    expect(totals.grandTotal.toFixed(2)).toBe("990.00");
    expect(totals.vat.toFixed(2)).toBe("0.00");
  });
});

describe("credit limit at invoice issue", () => {
  it("rejects when projected exposure exceeds limit", () => {
    expect(
      wouldExceedCreditLimit("10000.00", "9000.00", "2000.00"),
    ).toBe(true);
  });

  it("allows when within limit", () => {
    expect(
      wouldExceedCreditLimit("10000.00", "5000.00", "2000.00"),
    ).toBe(false);
  });
});
