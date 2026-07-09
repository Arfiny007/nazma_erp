import { FinancialReferenceType, LedgerPostingType, Prisma } from "@prisma/client";

import { LedgerPostingValidationError } from "@/lib/ledger/ledger-errors";
import { buildLedgerPostingKey } from "@/lib/ledger/posting-key";
import type {
  LedgerPostingInput,
  OpeningBalanceInput,
} from "@/lib/ledger/ledger-types";

/**
 * Opening balance infrastructure (PHASE_07C-ready).
 *
 * A dealer's opening balance is the FIRST ledger entry for that dealer at
 * go-live or onboarding. Sign convention matches `Dealer.currentBalance`:
 *   - Positive `amount` = dealer owes the company (debit AR).
 *   - Negative `amount` = advance credit / company owes the dealer (credit AR).
 *   - Zero `amount` is rejected — do not seed a no-op entry.
 *
 * This module ships builders only; PHASE_07C wires them into an
 * `openDealerBalance()` server action and `postOpeningBalance()` inside
 * `posting-service.ts`.
 *
 * @see ADR-024 §4, ADR-025
 */

const ZERO = new Prisma.Decimal(0);

/**
 * Canonical business reference prefix. Onboarding actions may extend with a
 * dealer code / date suffix (e.g., `OB-2026-01-DLR-000123`).
 */
export const OPENING_BALANCE_REFERENCE_PREFIX = "OB" as const;

/**
 * `referenceId` for opening-balance ledger entries. Opening balance is not a
 * separate document in PHASE_07A; the ledger row references the dealer itself.
 * PHASE_07C may introduce an `OpeningBalance` document — this helper stays
 * compatible because the `postingKey` derives from `(referenceType,
 * referenceId, postingType)`.
 */
export function buildOpeningBalanceReferenceId(dealerCode: string): string {
  if (!dealerCode) {
    throw new LedgerPostingValidationError(
      "buildOpeningBalanceReferenceId: dealerCode is required",
    );
  }
  return `${OPENING_BALANCE_REFERENCE_PREFIX}-${dealerCode}`;
}

/**
 * Build the deterministic `postingKey` for a dealer's opening balance.
 * Guarantees at-most-one opening entry per dealer via the unique
 * `LedgerEntry.postingKey` constraint.
 */
export function buildOpeningBalancePostingKey(dealerCode: string): string {
  return buildLedgerPostingKey({
    referenceType: FinancialReferenceType.OpeningBalance,
    referenceId: buildOpeningBalanceReferenceId(dealerCode),
    postingType: LedgerPostingType.OpeningBalance,
  });
}

/**
 * Compose the `LedgerPostingInput` for an opening balance.
 *
 * Debit vs credit is derived from the sign of `amount`:
 *   - `amount > 0` ⇒ debit = amount (dealer owes).
 *   - `amount < 0` ⇒ credit = |amount| (advance credit).
 *
 * `previousBalance` is expected to be `0` — opening balance is by definition
 * the first entry. PHASE_07C onboarding asserts this before calling.
 */
export function buildOpeningBalancePosting(params: {
  tx: LedgerPostingInput["tx"];
  input: OpeningBalanceInput;
  previousBalance: Prisma.Decimal;
}): LedgerPostingInput {
  const { input, tx, previousBalance } = params;

  if (!input.dealerCode) {
    throw new LedgerPostingValidationError(
      "OpeningBalanceInput.dealerCode is required",
    );
  }
  if (input.amount.equals(ZERO)) {
    throw new LedgerPostingValidationError(
      "OpeningBalanceInput.amount must be non-zero — opening balance cannot be a no-op",
    );
  }
  if (
    !(input.effectiveDate instanceof Date) ||
    Number.isNaN(input.effectiveDate.getTime())
  ) {
    throw new LedgerPostingValidationError(
      "OpeningBalanceInput.effectiveDate must be a valid Date",
    );
  }
  if (!previousBalance.equals(ZERO)) {
    throw new LedgerPostingValidationError(
      `Opening balance requires previousBalance = 0.00, got ${previousBalance.toFixed(2)}`,
    );
  }

  const referenceId = buildOpeningBalanceReferenceId(input.dealerCode);
  const amountAbs = input.amount.abs();
  const debit = input.amount.greaterThan(ZERO) ? amountAbs : ZERO;
  const credit = input.amount.lessThan(ZERO) ? amountAbs : ZERO;

  return {
    tx,
    dealerCode: input.dealerCode,
    transactionDate: input.effectiveDate,
    referenceType: FinancialReferenceType.OpeningBalance,
    referenceId,
    referenceNo: input.referenceNo,
    postingType: LedgerPostingType.OpeningBalance,
    postingKey: buildOpeningBalancePostingKey(input.dealerCode),
    debit,
    credit,
    previousBalance,
    createdById: input.createdById ?? null,
    remarks: input.remarks ?? null,
  };
}
