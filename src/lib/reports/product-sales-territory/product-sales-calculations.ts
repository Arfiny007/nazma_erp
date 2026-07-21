import { Prisma } from "@prisma/client";

/**
 * Decimal-safe helpers for Territory Product Sales — PHASE_12B / ADR-061.
 * Never use JavaScript number arithmetic for quantity aggregation.
 */

export const ZERO = new Prisma.Decimal(0);

export function normalizeQuantity(
  value: Prisma.Decimal | string | null | undefined,
): Prisma.Decimal {
  if (value == null) {
    return ZERO;
  }
  if (value instanceof Prisma.Decimal) {
    return value;
  }
  return new Prisma.Decimal(value);
}

export function quantityToFixed(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

/**
 * Deterministic rank with dense ties broken by productName ASC, productId ASC.
 * Input must already be sorted by quantity DESC, then name, then id.
 */
export function assignDenseRanksByQuantity(
  rows: ReadonlyArray<{
    soldQuantity: Prisma.Decimal;
    productName: string;
    productId: string;
  }>,
): number[] {
  const ranks: number[] = [];
  let rank = 0;
  let previous: (typeof rows)[number] | null = null;

  for (const row of rows) {
    if (
      !previous ||
      !row.soldQuantity.equals(previous.soldQuantity) ||
      row.productName !== previous.productName ||
      row.productId !== previous.productId
    ) {
      rank += 1;
    }
    ranks.push(rank);
    previous = row;
  }

  return ranks;
}

export function compareQuantityDescThenName(
  a: {
    soldQuantity: Prisma.Decimal;
    productName: string;
    productId: string;
  },
  b: {
    soldQuantity: Prisma.Decimal;
    productName: string;
    productId: string;
  },
): number {
  const qty = b.soldQuantity.comparedTo(a.soldQuantity);
  if (qty !== 0) {
    return qty;
  }
  const name = a.productName.localeCompare(b.productName);
  if (name !== 0) {
    return name;
  }
  return a.productId.localeCompare(b.productId);
}
