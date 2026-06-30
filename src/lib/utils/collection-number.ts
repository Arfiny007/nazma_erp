import type { Prisma } from "@prisma/client";

/**
 * Collection number generation utilities.
 *
 * Collection numbers follow `COL-000001`, `COL-000002`, … with a fixed-width,
 * zero-padded sequence. Generated inside the creating transaction.
 */

export const COLLECTION_NO_PREFIX = "COL";
export const COLLECTION_NO_SEPARATOR = "-";
export const COLLECTION_NO_PAD_LENGTH = 6;

const COLLECTION_NO_PATTERN = /^COL-(\d+)$/;

type CollectionReadClient = Pick<Prisma.TransactionClient, "collection">;

export function formatCollectionNo(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError(
      `Collection number sequence must be a positive integer, received: ${sequence}`,
    );
  }

  const padded = String(sequence).padStart(COLLECTION_NO_PAD_LENGTH, "0");
  return `${COLLECTION_NO_PREFIX}${COLLECTION_NO_SEPARATOR}${padded}`;
}

export function parseCollectionNoSequence(collectionNo: string): number | null {
  const match = COLLECTION_NO_PATTERN.exec(collectionNo.trim());
  if (!match) {
    return null;
  }

  const sequence = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(sequence) ? sequence : null;
}

export function isValidCollectionNo(collectionNo: string): boolean {
  return parseCollectionNoSequence(collectionNo) !== null;
}

export async function generateNextCollectionNo(
  client: CollectionReadClient,
): Promise<string> {
  const latest = await client.collection.findFirst({
    orderBy: { createdAt: "desc" },
    select: { collectionNo: true },
  });

  const lastSequence = latest
    ? (parseCollectionNoSequence(latest.collectionNo) ?? 0)
    : 0;

  return formatCollectionNo(lastSequence + 1);
}
