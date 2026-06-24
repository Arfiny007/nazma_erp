import { OrderStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  assertCanCancelChallan,
  assertCanConfirmChallan,
  assertCanCreateChallan,
  assertNotOverDelivery,
  computeAllocatableQuantity,
  computeRemainingQuantity,
  DeliveryWorkflowError,
  isOrderFullyDelivered,
  isOrderPartiallyDelivered,
  resolveOrderStatusAfterDelivery,
  toOrderLineFulfillment,
} from "@/lib/delivery/workflow";

describe("quantity reconciliation", () => {
  it("remaining qty uses confirmed only (display)", () => {
    expect(computeRemainingQuantity("100", "30").toFixed(2)).toBe("70.00");
    expect(computeRemainingQuantity("100", "30").toFixed(2)).toBe("70.00");
  });

  it("allocatable qty reserves draft challans (validation)", () => {
    expect(
      computeAllocatableQuantity("100", "30", "20").toFixed(2),
    ).toBe("50.00");
    expect(computeAllocatableQuantity("100", "100", "5").toFixed(2)).toBe(
      "0.00",
    );
  });

  it("toOrderLineFulfillment does not subtract draft from remaining", () => {
    const line = toOrderLineFulfillment({
      orderItemId: "line-1",
      productId: "prod-1",
      productName: "Tap",
      productSku: "SKU-1",
      orderedQuantity: "100",
      confirmedDeliveredQuantity: "40",
      draftDeliveredQuantity: "10",
    });
    expect(line.deliveredQuantity).toBe("40.00");
    expect(line.remainingQuantity).toBe("60.00");
    expect(line.isFullyDelivered).toBe(false);
  });

  it("assertNotOverDelivery rejects when request exceeds allocatable", () => {
    expect(() =>
      assertNotOverDelivery(
        [
          {
            orderItemId: "line-1",
            productId: "prod-1",
            orderedQuantity: "100",
            confirmedDeliveredQuantity: "60",
            draftDeliveredQuantity: "30",
          },
        ],
        [{ orderItemId: "line-1", quantity: "20" }],
      ),
    ).toThrow(DeliveryWorkflowError);
  });

  it("assertNotOverDelivery allows within allocatable capacity", () => {
    expect(() =>
      assertNotOverDelivery(
        [
          {
            orderItemId: "line-1",
            productId: "prod-1",
            orderedQuantity: "100",
            confirmedDeliveredQuantity: "60",
            draftDeliveredQuantity: "30",
          },
        ],
        [{ orderItemId: "line-1", quantity: "10" }],
      ),
    ).not.toThrow();
  });
});

describe("workflow guards", () => {
  it("blocks challan creation for non-approved orders", () => {
    expect(() => assertCanCreateChallan(OrderStatus.Draft)).toThrow(
      DeliveryWorkflowError,
    );
    expect(() => assertCanCreateChallan(OrderStatus.Cancelled)).toThrow(
      DeliveryWorkflowError,
    );
    expect(() => assertCanCreateChallan(OrderStatus.Rejected)).toThrow(
      DeliveryWorkflowError,
    );
  });

  it("allows challan creation for Approved and Partially_Delivered", () => {
    expect(() => assertCanCreateChallan(OrderStatus.Approved)).not.toThrow();
    expect(() =>
      assertCanCreateChallan(OrderStatus.Partially_Delivered),
    ).not.toThrow();
  });

  it("prevents duplicate confirmation and confirmation of cancelled challans", () => {
    expect(() => assertCanConfirmChallan("Confirmed")).toThrow(
      DeliveryWorkflowError,
    );
    expect(() => assertCanConfirmChallan("Cancelled")).toThrow(
      DeliveryWorkflowError,
    );
    expect(() => assertCanCancelChallan("Confirmed")).toThrow(
      DeliveryWorkflowError,
    );
  });

  it("resolves order status from confirmed quantities only", () => {
    const partialLine = toOrderLineFulfillment({
      orderItemId: "l1",
      productId: "p1",
      productName: "A",
      productSku: "S1",
      orderedQuantity: "100",
      confirmedDeliveredQuantity: "50",
      draftDeliveredQuantity: "0",
    });
    const fullLine = toOrderLineFulfillment({
      orderItemId: "l1",
      productId: "p1",
      productName: "A",
      productSku: "S1",
      orderedQuantity: "100",
      confirmedDeliveredQuantity: "100",
      draftDeliveredQuantity: "0",
    });

    expect(isOrderPartiallyDelivered([partialLine])).toBe(true);
    expect(isOrderFullyDelivered([partialLine])).toBe(false);
    expect(isOrderFullyDelivered([fullLine])).toBe(true);

    expect(
      resolveOrderStatusAfterDelivery(OrderStatus.Approved, [partialLine]),
    ).toBe(OrderStatus.Partially_Delivered);
    expect(
      resolveOrderStatusAfterDelivery(OrderStatus.Approved, [fullLine]),
    ).toBe(OrderStatus.Delivered);
  });
});
