/**
 * Client-safe quantity helpers for delivery challan UI.
 *
 * Mirrors `computeRemainingQuantity` / `computeAllocatableQuantity` from
 * `workflow.ts` without importing Prisma — safe for client components.
 */

const QUANTITY_SCALE = 2;

function toNumber(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundQuantity(value: number): number {
  const factor = 10 ** QUANTITY_SCALE;
  return Math.round(value * factor) / factor;
}

function formatQuantity(value: number): string {
  return roundQuantity(Math.max(0, value)).toFixed(QUANTITY_SCALE);
}

/** Display remaining: `ordered − confirmed`, clamped ≥ 0. */
export function computeRemainingQuantityClient(
  orderedQuantity: string | number,
  confirmedDeliveredQuantity: string | number,
): string {
  const remaining = roundQuantity(
    toNumber(orderedQuantity) - toNumber(confirmedDeliveredQuantity),
  );
  return formatQuantity(remaining);
}

/** Validation allocatable: `ordered − confirmed − draft`, clamped ≥ 0. */
export function computeAllocatableQuantityClient(
  orderedQuantity: string | number,
  confirmedDeliveredQuantity: string | number,
  draftDeliveredQuantity: string | number = 0,
): string {
  const allocatable = roundQuantity(
    toNumber(orderedQuantity) -
      toNumber(confirmedDeliveredQuantity) -
      toNumber(draftDeliveredQuantity),
  );
  return formatQuantity(allocatable);
}

/** `(delivered ÷ ordered) × 100`, 2 dp; `"0.00"` when ordered is zero. */
export function computeDeliveryPercentClient(
  deliveredQuantity: string | number,
  orderedQuantity: string | number,
): string {
  const ordered = toNumber(orderedQuantity);
  if (ordered <= 0) {
    return "0.00";
  }
  const percent = roundQuantity(
    (toNumber(deliveredQuantity) / ordered) * 100,
  );
  return percent.toFixed(QUANTITY_SCALE);
}

/** Quantity-weighted order-level delivery percent. */
export function computeOrderDeliveryPercentClient(
  lines: readonly { deliveredQuantity: string; orderedQuantity: string }[],
): string {
  const totalOrdered = lines.reduce(
    (sum, line) => sum + toNumber(line.orderedQuantity),
    0,
  );
  if (totalOrdered <= 0) {
    return "0.00";
  }
  const totalDelivered = lines.reduce(
    (sum, line) => sum + toNumber(line.deliveredQuantity),
    0,
  );
  return computeDeliveryPercentClient(totalDelivered, totalOrdered);
}

export function isQuantityPositive(value: string): boolean {
  return toNumber(value) > 0;
}

export function isQuantityWithinAllocatable(
  value: string,
  allocatableQuantity: string,
): boolean {
  return (
    toNumber(value) > 0 && toNumber(value) <= toNumber(allocatableQuantity)
  );
}
