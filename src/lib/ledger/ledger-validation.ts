import { Prisma } from "@prisma/client";

import { LedgerPostingValidationError } from "@/lib/ledger/ledger-errors";
import type { LedgerPostingInput } from "@/lib/ledger/ledger-types";

/**
 * Structural and semantic guards for `LedgerPostingInput`.
 *
 * The ledger service invokes these BEFORE touching the database. Every error
 * is a `LedgerPostingValidationError` — callers should not attempt to recover;
 * a validation failure means the caller assembled the wrong contract.
 *
 * @see ADR-025
 */

/** Amount comparison anchor to avoid re-allocating `new Prisma.Decimal(0)` per call. */
const ZERO = new Prisma.Decimal(0);

/**
 * Assert that a `LedgerPostingInput` is structurally valid.
 *
 * Rules:
 *   1. `dealerCode`, `referenceId`, `referenceNo` are non-empty strings.
 *   2. `debit` and `credit` are non-negative (`≥ 0`).
 *   3. Exactly one of `debit`/`credit` is strictly positive.
 *   4. `previousBalance` is a Decimal (signed — advance credit is negative).
 *   5. `transactionDate` is a valid `Date`.
 */
export function assertLedgerPostingInputValid(
  input: LedgerPostingInput,
): void {
  if (!input.dealerCode) {
    throw new LedgerPostingValidationError(
      "LedgerPostingInput.dealerCode is required",
    );
  }
  if (!input.referenceId) {
    throw new LedgerPostingValidationError(
      "LedgerPostingInput.referenceId is required",
    );
  }
  if (!input.referenceNo) {
    throw new LedgerPostingValidationError(
      "LedgerPostingInput.referenceNo is required",
    );
  }
  if (!(input.transactionDate instanceof Date) || Number.isNaN(input.transactionDate.getTime())) {
    throw new LedgerPostingValidationError(
      "LedgerPostingInput.transactionDate must be a valid Date",
    );
  }
  assertDecimalNonNegative(input.debit, "debit");
  assertDecimalNonNegative(input.credit, "credit");
  assertExactlyOneSide(input.debit, input.credit);

  if (!Prisma.Decimal.isDecimal(input.previousBalance)) {
    throw new LedgerPostingValidationError(
      "LedgerPostingInput.previousBalance must be a Prisma.Decimal",
    );
  }

  if (input.postingKey !== undefined && input.postingKey.trim() === "") {
    throw new LedgerPostingValidationError(
      "LedgerPostingInput.postingKey must be non-empty when provided",
    );
  }
}

/**
 * Compute the running balance after applying a posting.
 *
 * `balance = previousBalance + debit - credit`
 *
 * Signed: advance credit (negative AR) is preserved as a negative running
 * balance. Matches the sign convention on `Dealer.currentBalance`.
 */
export function applyPostingToBalance(
  previousBalance: Prisma.Decimal,
  debit: Prisma.Decimal,
  credit: Prisma.Decimal,
): Prisma.Decimal {
  return previousBalance.plus(debit).minus(credit);
}

/**
 * Guard used by helpers that MUST NOT update or delete a persisted ledger row.
 *
 * The database schema itself does not prevent updates — this runtime guard is
 * the enforcement point until a database-level rule is added. Any code path
 * that attempts to `tx.ledgerEntry.update` / `tx.ledgerEntry.delete` for a
 * historical row must instead build a compensating `LedgerPostingInput` with
 * `reversesEntryId` set.
 */
export function assertLedgerAppendOnly(
  operation: "update" | "delete",
  entryId: string,
): never {
  throw new LedgerPostingValidationError(
    `Ledger entry ${entryId} cannot be ${operation}d. Ledger is append-only — post a compensating reversal via createLedgerEntry() with reversesEntryId.`,
  );
}

function assertDecimalNonNegative(
  value: Prisma.Decimal,
  field: "debit" | "credit",
): void {
  if (!Prisma.Decimal.isDecimal(value)) {
    throw new LedgerPostingValidationError(
      `LedgerPostingInput.${field} must be a Prisma.Decimal`,
    );
  }
  if (value.lessThan(ZERO)) {
    throw new LedgerPostingValidationError(
      `LedgerPostingInput.${field} must be non-negative, got ${value.toFixed(2)}`,
    );
  }
}

function assertExactlyOneSide(
  debit: Prisma.Decimal,
  credit: Prisma.Decimal,
): void {
  const debitPositive = debit.greaterThan(ZERO);
  const creditPositive = credit.greaterThan(ZERO);

  if (debitPositive && creditPositive) {
    throw new LedgerPostingValidationError(
      `LedgerPostingInput cannot set both debit (${debit.toFixed(2)}) and credit (${credit.toFixed(2)}) — post one side only.`,
    );
  }
  if (!debitPositive && !creditPositive) {
    throw new LedgerPostingValidationError(
      "LedgerPostingInput must set exactly one of debit or credit to a positive amount.",
    );
  }
}
