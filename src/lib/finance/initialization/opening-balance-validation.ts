import { OpeningBalanceStatus, type Prisma } from "@prisma/client";

import { OpeningBalanceError } from "@/lib/finance/initialization/opening-balance-errors";
import type { OpeningBalanceRecord } from "@/lib/finance/initialization/opening-balance-types";

/**
 * Financial Initialization Engine — business rule guards.
 *
 * Split from `opening-balance.ts` so the state machine transitions stay
 * readable and every rule has one home. Guards throw `OpeningBalanceError`;
 * the caller's transaction rolls back on any failure.
 *
 * @see ADR-028
 */

export interface OpeningBalanceFieldIssue {
  field: string;
  messageKey: string;
}

/** Rejects a dealer that has never been onboarded into the ERP. */
export function assertDealerExists<T>(dealer: T | null): T {
  if (!dealer) {
    throw new OpeningBalanceError(
      "DEALER_NOT_FOUND",
      "openingBalance.error.dealerNotFound",
    );
  }
  return dealer;
}

/**
 * Enforces "every dealer can be initialized exactly once". A dealer with ANY
 * existing `OpeningBalance` row — Draft, Validated, Posted, or Locked —
 * cannot start a second one; the unique `dealerCode` constraint backs this
 * at the database level, this guard just fails fast with a clear message.
 */
export function assertDealerNotInitialized(
  existing: { id: string } | null,
): void {
  if (existing) {
    throw new OpeningBalanceError(
      "ALREADY_INITIALIZED",
      "openingBalance.error.alreadyInitialized",
    );
  }
}

export function assertRecordFound<T>(record: T | null): T {
  if (!record) {
    throw new OpeningBalanceError(
      "RECORD_NOT_FOUND",
      "openingBalance.error.notFound",
    );
  }
  return record;
}

/** Draft is the only status a record may still be validated from. */
export function assertDraftForValidation(
  status: OpeningBalanceStatus,
): void {
  if (status !== OpeningBalanceStatus.Draft) {
    throw new OpeningBalanceError(
      "INVALID_STATE_TRANSITION",
      "openingBalance.error.notDraft",
    );
  }
}

/**
 * Posting requires a Validated record. A record already Posted/Locked is
 * NOT an error here — the service layer treats a re-post of an already
 * Locked record as an idempotent replay (returns the existing result). This
 * guard only rejects postings attempted straight from Draft (validation was
 * skipped) — Draft and Validation must never affect the ledger.
 */
export function assertValidatedForPosting(
  status: OpeningBalanceStatus,
): void {
  if (status === OpeningBalanceStatus.Draft) {
    throw new OpeningBalanceError(
      "INVALID_STATE_TRANSITION",
      "openingBalance.error.notValidated",
    );
  }
}

/** Opening Balance is immutable once Locked — never edit, never delete. */
export function assertNotLocked(status: OpeningBalanceStatus): void {
  if (status === OpeningBalanceStatus.Locked) {
    throw new OpeningBalanceError(
      "IMMUTABLE_RECORD",
      "openingBalance.error.immutable",
    );
  }
}

/**
 * Structural + business validation for the "Validation" wizard step.
 * Returns field-level issues instead of throwing so the UI can render them
 * inline — the action only transitions Draft → Validated when this list is
 * empty.
 */
export function collectOpeningBalanceValidationIssues(params: {
  amount: Prisma.Decimal;
  effectiveDate: Date;
  dealerExists: boolean;
}): OpeningBalanceFieldIssue[] {
  const issues: OpeningBalanceFieldIssue[] = [];

  if (!params.dealerExists) {
    issues.push({
      field: "dealerCode",
      messageKey: "openingBalance.error.dealerNotFound",
    });
  }

  if (params.amount.decimalPlaces() > 2) {
    issues.push({
      field: "amount",
      messageKey: "openingBalance.validation.amountPrecision",
    });
  }

  if (
    !(params.effectiveDate instanceof Date) ||
    Number.isNaN(params.effectiveDate.getTime())
  ) {
    issues.push({
      field: "effectiveDate",
      messageKey: "openingBalance.validation.effectiveDateInvalid",
    });
  } else if (params.effectiveDate.getTime() > Date.now()) {
    issues.push({
      field: "effectiveDate",
      messageKey: "openingBalance.validation.effectiveDateFuture",
    });
  }

  return issues;
}

/** Type guard the engine uses before treating a fetched row as posting-ready. */
export function assertPreviousBalanceZero(previousBalance: Prisma.Decimal): void {
  if (!previousBalance.isZero()) {
    throw new OpeningBalanceError(
      "INTERNAL_ERROR",
      "openingBalance.error.previousBalanceNotZero",
    );
  }
}

export type { OpeningBalanceRecord };
