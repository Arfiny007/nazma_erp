import type { Prisma } from "@prisma/client";

/**
 * Delivery challan number generation utilities.
 *
 * Challan numbers follow the canonical format `CHL-000001`, `CHL-000002`, ...
 * with a fixed-width, zero-padded sequence number. Numbers are generated
 * sequentially from the most recently created challan.
 */

export const CHALLAN_NO_PREFIX = "CHL";
export const CHALLAN_NO_SEPARATOR = "-";
export const CHALLAN_NO_PAD_LENGTH = 6;

/** Matches `CHL-000001` (and naturally any longer sequence beyond 999999). */
const CHALLAN_NO_PATTERN = /^CHL-(\d+)$/;

type ChallanReadClient = Pick<Prisma.TransactionClient, "deliveryChallan">;

/** Formats a numeric sequence into a canonical challan number. */
export function formatChallanNo(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError(
      `Challan number sequence must be a positive integer, received: ${sequence}`,
    );
  }

  const padded = String(sequence).padStart(CHALLAN_NO_PAD_LENGTH, "0");
  return `${CHALLAN_NO_PREFIX}${CHALLAN_NO_SEPARATOR}${padded}`;
}

/**
 * Extracts the numeric sequence from a challan number, or `null` when the value
 * does not match the canonical format.
 */
export function parseChallanNoSequence(challanNo: string): number | null {
  const match = CHALLAN_NO_PATTERN.exec(challanNo.trim());
  if (!match) {
    return null;
  }

  const sequence = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(sequence) ? sequence : null;
}

/** Type guard validating that a string is a well-formed challan number. */
export function isValidChallanNo(challanNo: string): boolean {
  return parseChallanNoSequence(challanNo) !== null;
}

/**
 * Computes the next challan number by inspecting the most recently created
 * challan. Must run inside the same transaction that persists the new challan.
 */
export async function generateNextChallanNo(
  client: ChallanReadClient,
): Promise<string> {
  const latest = await client.deliveryChallan.findFirst({
    orderBy: { createdAt: "desc" },
    select: { challanNo: true },
  });

  const lastSequence = latest
    ? (parseChallanNoSequence(latest.challanNo) ?? 0)
    : 0;

  return formatChallanNo(lastSequence + 1);
}
