import type { Prisma } from "@prisma/client";

/**
 * Dealer code generation utilities.
 *
 * Dealer codes follow the canonical format `DLR-0001`, `DLR-0002`, ... with a
 * fixed-width, zero-padded sequence number. Codes are generated sequentially
 * from the highest existing code so they remain stable, human-readable and
 * sortable.
 */

export const DEALER_CODE_PREFIX = "DLR";
export const DEALER_CODE_SEPARATOR = "-";
export const DEALER_CODE_PAD_LENGTH = 4;

/** Matches `DLR-0001` (and naturally any longer sequence beyond 9999). */
const DEALER_CODE_PATTERN = /^DLR-(\d+)$/;

/**
 * A Prisma client capable of reading dealers. Accepts both the root client and
 * an interactive transaction client so callers can generate codes inside the
 * same transaction that persists the dealer.
 */
type DealerReadClient = Pick<Prisma.TransactionClient, "dealer">;

/** Formats a numeric sequence into a canonical dealer code. */
export function formatDealerCode(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError(
      `Dealer code sequence must be a positive integer, received: ${sequence}`,
    );
  }

  const padded = String(sequence).padStart(DEALER_CODE_PAD_LENGTH, "0");
  return `${DEALER_CODE_PREFIX}${DEALER_CODE_SEPARATOR}${padded}`;
}

/**
 * Extracts the numeric sequence from a dealer code, or `null` when the value
 * does not match the canonical format.
 */
export function parseDealerCodeSequence(dealerCode: string): number | null {
  const match = DEALER_CODE_PATTERN.exec(dealerCode.trim());
  if (!match) {
    return null;
  }

  const sequence = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(sequence) ? sequence : null;
}

/** Type guard validating that a string is a well-formed dealer code. */
export function isValidDealerCode(dealerCode: string): boolean {
  return parseDealerCodeSequence(dealerCode) !== null;
}

/**
 * Computes the next dealer code by inspecting the most recently created dealer.
 *
 * Sorting by `createdAt DESC` (not `dealerCode DESC`) is intentional: the
 * lexicographic order of dealer codes breaks once the sequence exceeds the
 * zero-padding width (e.g. "DLR-9999" sorts after "DLR-10000"), whereas the
 * creation-time order is always monotonic.  The unique constraint on
 * `Dealer.dealerCode` remains the final guard against concurrent inserts, so
 * callers should retry on a unique-violation.
 *
 * Must be called inside the same transaction that will persist the new dealer
 * so the read and write are atomic relative to other concurrent inserts.
 */
export async function generateNextDealerCode(
  client: DealerReadClient,
): Promise<string> {
  const latest = await client.dealer.findFirst({
    orderBy: { createdAt: "desc" },
    select: { dealerCode: true },
  });

  const lastSequence = latest
    ? (parseDealerCodeSequence(latest.dealerCode) ?? 0)
    : 0;

  return formatDealerCode(lastSequence + 1);
}
