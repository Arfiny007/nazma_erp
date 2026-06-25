import { Prisma } from "@prisma/client";

import {
  calculateOrderTotals,
  type CalculatorLineInput,
  type OrderTotals,
} from "@/lib/utils/order-calculator";

/**
 * Invoice line construction from delivery challan quantities.
 *
 * Quantities originate ONLY from DeliveryChallanItem rows. Unit prices and
 * proportional discounts are sourced from the parent SalesOrderItem at issue
 * time, then snapshotted into immutable InvoiceItem records.
 */

const ROUNDING = Prisma.Decimal.ROUND_HALF_UP;
const MONEY_SCALE = 2;

export interface ChallanLineForInvoice {
  challanItemId: string;
  orderItemId: string;
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  challanQuantity: Prisma.Decimal;
  orderItemQuantity: Prisma.Decimal;
  orderItemUnitPrice: Prisma.Decimal;
  orderItemDiscount: Prisma.Decimal;
}

export interface InvoiceLineSnapshot {
  challanItemId: string;
  orderItemId: string;
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

/**
 * Allocates order-line discount proportionally to the challan quantity shipped.
 *
 * `discount = orderLineDiscount × (challanQty ÷ orderQty)`, rounded half-up.
 */
export function allocateProportionalDiscount(
  orderLineDiscount: Prisma.Decimal,
  challanQuantity: Prisma.Decimal,
  orderQuantity: Prisma.Decimal,
): Prisma.Decimal {
  if (orderQuantity.lessThanOrEqualTo(0)) {
    return new Prisma.Decimal(0);
  }
  return orderLineDiscount
    .times(challanQuantity.dividedBy(orderQuantity))
    .toDecimalPlaces(MONEY_SCALE, ROUNDING);
}

function toCalculatorInput(line: ChallanLineForInvoice): CalculatorLineInput {
  return {
    quantity: line.challanQuantity,
    unitPrice: line.orderItemUnitPrice,
    discount: allocateProportionalDiscount(
      line.orderItemDiscount,
      line.challanQuantity,
      line.orderItemQuantity,
    ),
  };
}

/**
 * Builds immutable invoice line snapshots and header totals from challan lines.
 * Reuses the order Decimal engine — no duplicated money math.
 */
export function buildInvoiceFromChallanLines(
  lines: readonly ChallanLineForInvoice[],
): { snapshots: InvoiceLineSnapshot[]; totals: OrderTotals } {
  const calculatorInputs = lines.map(toCalculatorInput);
  const totals = calculateOrderTotals(calculatorInputs);

  const snapshots: InvoiceLineSnapshot[] = lines.map((line, index) => {
    const calculated = totals.lines[index];
    return {
      challanItemId: line.challanItemId,
      orderItemId: line.orderItemId,
      productId: line.productId,
      productCode: line.productCode,
      productName: line.productName,
      unit: line.unit,
      quantity: calculated.quantity,
      unitPrice: calculated.unitPrice,
      discount: calculated.discount,
      lineTotal: calculated.total,
    };
  });

  return { snapshots, totals };
}
