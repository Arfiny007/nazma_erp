"use server";

import { Prisma } from "@prisma/client";

import { requirePermission } from "@/lib/rbac/guards";
import { calculateOrderTotals } from "@/lib/utils/order-calculator";
import { previewOrderTotalsSchema } from "@/lib/validators/order.schema";
import type { ActionResult, OrderTotalsPreviewDTO } from "@/types/order";

import { fail, fromZodError, ok } from "./helpers";

/**
 * Computes a live financial preview for an in-progress order using the same
 * Decimal-safe {@link calculateOrderTotals} engine that the create/update
 * actions use. No monetary arithmetic is duplicated on the client.
 *
 * The order-level discount percentage (a UI affordance) is converted into the
 * per-line discount amounts the backend model expects: each line's discount is
 * `lineSubtotal * percent / 100`, rounded half-up to two decimals. Summing the
 * rounded per-line discounts is exactly what the persisted order will store, so
 * the preview and the committed order can never disagree.
 *
 * The returned per-line `discount` amounts are authoritative and are submitted
 * verbatim by the form, guaranteeing the displayed totals match the saved ones.
 */
export async function previewOrderTotals(
  input: unknown,
): Promise<ActionResult<OrderTotalsPreviewDTO>> {
  try {
    await requirePermission("orders:view");
  } catch {
    return fail<OrderTotalsPreviewDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = previewOrderTotalsSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { items, discountPercent } = parsed.data;

  const percent = new Prisma.Decimal(discountPercent ?? "0");
  const hundred = new Prisma.Decimal(100);

  // First pass: reuse the engine to obtain Decimal-safe line subtotals.
  const base = calculateOrderTotals(
    items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  );

  // Derive per-line discount amounts from the order-level percentage, then run
  // the engine again so every reported figure originates from the calculator.
  const totals = calculateOrderTotals(
    base.lines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.lineSubtotal
        .times(percent)
        .dividedBy(hundred)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
    })),
  );

  return ok({
    lines: totals.lines.map((line) => ({
      lineSubtotal: line.lineSubtotal.toFixed(2),
      discount: line.discount.toFixed(2),
      total: line.total.toFixed(2),
    })),
    subtotal: totals.subtotal.toFixed(2),
    discountPercent: percent.toFixed(2),
    discountAmount: totals.discountAmount.toFixed(2),
    vat: totals.vat.toFixed(2),
    grandTotal: totals.grandTotal.toFixed(2),
  });
}
