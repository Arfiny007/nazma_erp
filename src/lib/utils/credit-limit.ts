import { Prisma } from "@prisma/client";

import type { CreditStatusLevel, CreditUtilization } from "@/types/dealer";

/**
 * Credit limit utilities.
 *
 * All arithmetic uses Prisma's arbitrary-precision `Decimal` to avoid floating
 * point drift on monetary values, in line with the project's financial rules.
 */

/** Lower bound (inclusive) of the `yellow` utilization band. */
export const CREDIT_THRESHOLD_YELLOW_PERCENT = 85;
/** Lower bound (inclusive) of the `red` utilization band. */
export const CREDIT_THRESHOLD_RED_PERCENT = 100;

/** Any value accepted as a monetary amount by the credit utilities. */
export type DecimalLike = Prisma.Decimal | string | number;

function toDecimal(value: DecimalLike): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

/**
 * Maps a utilization percentage to its severity band.
 *
 * - `green`  -> below 85%
 * - `yellow` -> 85% up to (but not including) 100%
 * - `red`    -> 100% and above
 */
export function resolveCreditStatus(
  utilizationPercent: number,
): CreditStatusLevel {
  if (utilizationPercent >= CREDIT_THRESHOLD_RED_PERCENT) {
    return "red";
  }
  if (utilizationPercent >= CREDIT_THRESHOLD_YELLOW_PERCENT) {
    return "yellow";
  }
  return "green";
}

/**
 * Computes the full credit utilization snapshot for a dealer.
 *
 * Edge cases:
 * - A zero (or unset) credit limit with any outstanding balance is treated as
 *   over the limit (`red`, 100%).
 * - A zero credit limit with a zero balance is healthy (`green`, 0%).
 */
export function calculateCreditUtilization(
  creditLimit: DecimalLike,
  currentBalance: DecimalLike,
): CreditUtilization {
  const limit = toDecimal(creditLimit);
  const balance = toDecimal(currentBalance);
  const available = limit.minus(balance);

  let utilizationPercent: number;
  let status: CreditStatusLevel;
  let isOverLimit: boolean;

  if (limit.lessThanOrEqualTo(0)) {
    const hasBalance = balance.greaterThan(0);
    utilizationPercent = hasBalance ? CREDIT_THRESHOLD_RED_PERCENT : 0;
    status = hasBalance ? "red" : "green";
    isOverLimit = hasBalance;
  } else {
    // Use Decimal-native toFixed for precise 2-decimal rounding rather than
    // converting to float first, which would introduce IEEE 754 representation
    // errors before the rounding step.
    utilizationPercent = parseFloat(
      balance.dividedBy(limit).times(100).toFixed(2),
    );
    status = resolveCreditStatus(utilizationPercent);
    isOverLimit = balance.greaterThanOrEqualTo(limit);
  }

  return {
    creditLimit: limit.toFixed(2),
    currentBalance: balance.toFixed(2),
    availableCredit: available.toFixed(2),
    utilizationPercent,
    status,
    isOverLimit,
  };
}

/**
 * Determines whether applying `additionalAmount` to the current balance would
 * exceed the credit limit. Useful for guarding new orders/invoices.
 */
export function wouldExceedCreditLimit(
  creditLimit: DecimalLike,
  currentBalance: DecimalLike,
  additionalAmount: DecimalLike,
): boolean {
  const limit = toDecimal(creditLimit);
  const projected = toDecimal(currentBalance).plus(toDecimal(additionalAmount));
  return projected.greaterThan(limit);
}
