import { Prisma } from "@prisma/client";

import {
  LedgerBalanceMismatchError,
  LedgerDuplicatePostingError,
} from "@/lib/ledger/ledger-errors";
import {
  buildLedgerEntryCreateData,
  type LedgerEntryCreateData,
} from "@/lib/ledger/ledger-posting";
import type {
  LedgerPostingInput,
  LedgerPostingResult,
} from "@/lib/ledger/ledger-types";
import { assertLedgerPostingInputValid } from "@/lib/ledger/ledger-validation";

/**
 * Ledger service — the SINGLE write path into `LedgerEntry`.
 *
 * `createLedgerEntry` is called ONLY from `src/lib/finance/posting-service.ts`
 * (PHASE_07B onwards). No business action, no server action, no UI code
 * writes directly to the ledger.
 *
 * Contract:
 *   - Caller opens the Prisma transaction and holds the dealer row lock.
 *   - Caller supplies `previousBalance` from the locked snapshot.
 *   - `postingKey` uniqueness makes the write idempotent under retry.
 *   - After a successful insert, callers MUST update
 *     `Dealer.currentBalance` to match `result.balance`.
 *
 * @see ADR-024 §3, ADR-025
 */

/**
 * Insert a `LedgerEntry` row for the given posting input.
 *
 * Idempotency: when a row already exists for the derived (or supplied)
 * `postingKey`, the function returns the existing row with `isNew = false`
 * instead of throwing. Business actions that legitimately retry (e.g., invoice
 * issue on `P2002`) get a stable outcome without duplicate ledger rows.
 *
 * Balance assertion: the persisted `LedgerEntry.balance` is derived from
 * `previousBalance + debit - credit`. Callers should compare it against
 * `Dealer.currentBalance` after the atomic increment/decrement in
 * `posting-service.ts` and raise `LedgerBalanceMismatchError` on drift.
 */
export async function createLedgerEntry(
  input: LedgerPostingInput,
): Promise<LedgerPostingResult> {
  assertLedgerPostingInputValid(input);

  const createData = buildLedgerEntryCreateData(input);

  try {
    const row = await input.tx.ledgerEntry.create({ data: createData });
    return toLedgerPostingResult(row, true);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      isPostingKeyUniqueViolation(error)
    ) {
      const existing = await input.tx.ledgerEntry.findUnique({
        where: { postingKey: createData.postingKey },
      });
      if (existing) {
        assertIdempotentReplay(existing, createData);
        return toLedgerPostingResult(existing, false);
      }
      throw new LedgerDuplicatePostingError(createData.postingKey);
    }
    throw error;
  }
}

/**
 * Assert that the persisted `LedgerEntry.balance` equals the balance the
 * caller intends to store on `Dealer.currentBalance`. Raises
 * `LedgerBalanceMismatchError` on drift — must be called INSIDE the ledger
 * posting transaction so the mismatch rolls the entire transaction back.
 */
export function assertLedgerBalanceMatchesCache(
  dealerCode: string,
  ledgerBalance: Prisma.Decimal,
  cachedBalance: Prisma.Decimal,
): void {
  if (!ledgerBalance.equals(cachedBalance)) {
    throw new LedgerBalanceMismatchError(
      dealerCode,
      ledgerBalance.toFixed(2),
      cachedBalance.toFixed(2),
    );
  }
}

function toLedgerPostingResult(
  row: {
    id: string;
    postingKey: string;
    dealerCode: string;
    transactionDate: Date;
    postingDate: Date;
    referenceType: LedgerPostingResult["referenceType"];
    referenceId: string;
    referenceNo: string;
    postingType: LedgerPostingResult["postingType"];
    debit: Prisma.Decimal;
    credit: Prisma.Decimal;
    balance: Prisma.Decimal;
    reversesEntryId: string | null;
    createdById: string | null;
  },
  isNew: boolean,
): LedgerPostingResult {
  return {
    id: row.id,
    postingKey: row.postingKey,
    dealerCode: row.dealerCode,
    transactionDate: row.transactionDate,
    postingDate: row.postingDate,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    referenceNo: row.referenceNo,
    postingType: row.postingType,
    debit: row.debit,
    credit: row.credit,
    balance: row.balance,
    reversesEntryId: row.reversesEntryId,
    createdById: row.createdById,
    isNew,
  };
}

function isPostingKeyUniqueViolation(
  error: Prisma.PrismaClientKnownRequestError,
): boolean {
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some((field) => String(field).includes("postingKey"));
  }
  if (typeof target === "string") {
    return target.includes("postingKey");
  }
  return false;
}

/**
 * Sanity check the existing row on idempotent replay. If a retry arrives with
 * different debit/credit/balance for the same `postingKey`, the caller's
 * business action is inconsistent — surface as a duplicate posting error.
 */
function assertIdempotentReplay(
  existing: {
    postingKey: string;
    debit: Prisma.Decimal;
    credit: Prisma.Decimal;
    balance: Prisma.Decimal;
    referenceId: string;
    referenceType: LedgerPostingResult["referenceType"];
    postingType: LedgerPostingResult["postingType"];
  },
  attempt: LedgerEntryCreateData,
): void {
  const attemptDebit = toDecimal(attempt.debit);
  const attemptCredit = toDecimal(attempt.credit);
  const attemptBalance = toDecimal(attempt.balance);

  const drift =
    !existing.debit.equals(attemptDebit) ||
    !existing.credit.equals(attemptCredit) ||
    !existing.balance.equals(attemptBalance) ||
    existing.referenceId !== attempt.referenceId ||
    existing.referenceType !== attempt.referenceType ||
    existing.postingType !== attempt.postingType;

  if (drift) {
    throw new LedgerDuplicatePostingError(existing.postingKey);
  }
}

type DecimalLike =
  | Prisma.Decimal
  | Prisma.Decimal.Value
  | { toFixed(digits?: number): string };

function toDecimal(value: DecimalLike): Prisma.Decimal {
  if (Prisma.Decimal.isDecimal(value)) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Prisma.Decimal(value);
  }
  return new Prisma.Decimal(value.toFixed(20));
}
