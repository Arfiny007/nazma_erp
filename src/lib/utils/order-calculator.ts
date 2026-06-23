import { Prisma } from "@prisma/client";

/**
 * Sales order financial calculation engine.
 *
 * All arithmetic uses Prisma's arbitrary-precision `Decimal` to avoid IEEE-754
 * floating-point drift on monetary values, in line with the project's financial
 * rules. No `number` math is performed on money at any point.
 *
 * VAT is already included in the product price (business rule), so this engine
 * never computes VAT — the `vat` output is always `0.00` and exists only to
 * satisfy the persisted `SalesOrder.vat` column.
 *
 * Line math:
 *   lineSubtotal = quantity * unitPrice            (rounded to 2 dp)
 *   total        = lineSubtotal - discount         (rounded to 2 dp)
 *
 * Order math:
 *   subtotal       = Σ lineSubtotal
 *   discountAmount = Σ discount
 *   grandTotal     = subtotal - discountAmount
 *   vat            = 0.00
 */

/** Any value accepted as a monetary / quantity amount by the calculator. */
export type DecimalLike = Prisma.Decimal | string | number;

/** Rounding mode applied to all 2-decimal monetary results. */
const MONEY_SCALE = 2;
const ROUNDING = Prisma.Decimal.ROUND_HALF_UP;

const ZERO = new Prisma.Decimal(0);

function toDecimal(value: DecimalLike): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function money(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(MONEY_SCALE, ROUNDING);
}

/** Raw line input fed to the calculator. */
export interface CalculatorLineInput {
  quantity: DecimalLike;
  unitPrice: DecimalLike;
  /** Per-line discount amount (monetary). Defaults to 0 when omitted. */
  discount?: DecimalLike;
}

/** A fully-computed order line, with all amounts as `Decimal`. */
export interface CalculatedLine {
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discount: Prisma.Decimal;
  /** `quantity * unitPrice`, rounded to 2 dp. */
  lineSubtotal: Prisma.Decimal;
  /** `lineSubtotal - discount`, rounded to 2 dp. */
  total: Prisma.Decimal;
}

/** Computed totals for an entire order. */
export interface OrderTotals {
  lines: CalculatedLine[];
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  vat: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
}

/**
 * Computes per-line and order-level totals for a set of order lines.
 *
 * The result is purely a function of its inputs (no I/O, no rounding surprises)
 * and is safe to call inside a transaction. Validation of business constraints
 * (e.g. discount must not exceed the line subtotal) is the caller's
 * responsibility — see {@link findInvalidLineIndex}.
 */
export function calculateOrderTotals(
  items: readonly CalculatorLineInput[],
): OrderTotals {
  const lines: CalculatedLine[] = items.map((item) => {
    const quantity = toDecimal(item.quantity);
    const unitPrice = toDecimal(item.unitPrice);
    const discount =
      item.discount === undefined ? ZERO : toDecimal(item.discount);

    const lineSubtotal = money(quantity.times(unitPrice));
    const total = money(lineSubtotal.minus(discount));

    return { quantity, unitPrice, discount, lineSubtotal, total };
  });

  const subtotal = money(
    lines.reduce((acc, line) => acc.plus(line.lineSubtotal), ZERO),
  );
  const discountAmount = money(
    lines.reduce((acc, line) => acc.plus(line.discount), ZERO),
  );
  const vat = money(ZERO);
  const grandTotal = money(subtotal.minus(discountAmount));

  return { lines, subtotal, discountAmount, vat, grandTotal };
}

/**
 * Returns the index of the first line whose discount exceeds its subtotal
 * (which would produce a negative line total), or `-1` when all lines are
 * valid. Used by actions to reject malformed pricing before persistence.
 */
export function findInvalidLineIndex(totals: OrderTotals): number {
  return totals.lines.findIndex((line) => line.total.lessThan(0));
}
