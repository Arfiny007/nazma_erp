import type { Prisma } from "@prisma/client";

/**
 * Sales order number generation utilities.
 *
 * Order numbers follow the canonical format `ORD-000001`, `ORD-000002`, ...
 * with a fixed-width, zero-padded sequence number. Numbers are generated
 * sequentially from the most recently created order so they remain stable,
 * human-readable and sortable.
 */

export const ORDER_NO_PREFIX = "ORD";
export const ORDER_NO_SEPARATOR = "-";
export const ORDER_NO_PAD_LENGTH = 6;

/** Matches `ORD-000001` (and naturally any longer sequence beyond 999999). */
const ORDER_NO_PATTERN = /^ORD-(\d+)$/;

/**
 * A Prisma client capable of reading sales orders. Accepts both the root client
 * and an interactive transaction client so callers can generate numbers inside
 * the same transaction that persists the order.
 */
type OrderReadClient = Pick<Prisma.TransactionClient, "salesOrder">;

/** Formats a numeric sequence into a canonical order number. */
export function formatOrderNo(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError(
      `Order number sequence must be a positive integer, received: ${sequence}`,
    );
  }

  const padded = String(sequence).padStart(ORDER_NO_PAD_LENGTH, "0");
  return `${ORDER_NO_PREFIX}${ORDER_NO_SEPARATOR}${padded}`;
}

/**
 * Extracts the numeric sequence from an order number, or `null` when the value
 * does not match the canonical format.
 */
export function parseOrderNoSequence(orderNo: string): number | null {
  const match = ORDER_NO_PATTERN.exec(orderNo.trim());
  if (!match) {
    return null;
  }

  const sequence = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(sequence) ? sequence : null;
}

/** Type guard validating that a string is a well-formed order number. */
export function isValidOrderNo(orderNo: string): boolean {
  return parseOrderNoSequence(orderNo) !== null;
}

/**
 * Computes the next order number by inspecting the most recently created order.
 *
 * Sorting by `createdAt DESC` (not `orderNo DESC`) is intentional: the
 * lexicographic order of order numbers breaks once the sequence exceeds the
 * zero-padding width, whereas the creation-time order is always monotonic. The
 * unique constraint on `SalesOrder.orderNo` remains the final guard against
 * concurrent inserts, so callers should retry on a unique-violation.
 *
 * Must be called inside the same transaction that will persist the new order so
 * the read and write are atomic relative to other concurrent inserts.
 */
export async function generateNextOrderNo(
  client: OrderReadClient,
): Promise<string> {
  const latest = await client.salesOrder.findFirst({
    orderBy: { createdAt: "desc" },
    select: { orderNo: true },
  });

  const lastSequence = latest
    ? (parseOrderNoSequence(latest.orderNo) ?? 0)
    : 0;

  return formatOrderNo(lastSequence + 1);
}
