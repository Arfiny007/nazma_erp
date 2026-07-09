/**
 * Ledger domain errors.
 *
 * The ledger is append-only. All error classes below signal violations of the
 * append-only contract, balance assertion, or idempotency guard. Every failure
 * MUST roll back the enclosing Prisma transaction — never swallow.
 *
 * @see ADR-025 — Enterprise Ledger Foundation
 */

/** Base class for all ledger foundation errors. */
export class LedgerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
  }
}

/** Raised when a `LedgerPostingInput` fails structural validation. */
export class LedgerPostingValidationError extends LedgerError {
  constructor(message: string) {
    super("LEDGER_POSTING_INVALID", message);
    this.name = "LedgerPostingValidationError";
  }
}

/**
 * Raised when the same `postingKey` is inserted twice.
 *
 * PostingService retries and idempotent business actions rely on the unique
 * `postingKey` constraint to prevent duplicate ledger lines. This error carries
 * the offending key so the caller can decide whether the retry is expected
 * (idempotent no-op) or a genuine collision (bug).
 */
export class LedgerDuplicatePostingError extends LedgerError {
  readonly postingKey: string;

  constructor(postingKey: string) {
    super(
      "LEDGER_DUPLICATE_POSTING",
      `Ledger entry with postingKey "${postingKey}" already exists`,
    );
    this.name = "LedgerDuplicatePostingError";
    this.postingKey = postingKey;
  }
}

/**
 * Raised when `LedgerEntry.balance` does not match `Dealer.currentBalance`
 * after posting. Indicates a serialization or lock-holding bug — must fail
 * loudly and roll back.
 */
export class LedgerBalanceMismatchError extends LedgerError {
  readonly dealerCode: string;
  readonly ledgerBalance: string;
  readonly cachedBalance: string;

  constructor(
    dealerCode: string,
    ledgerBalance: string,
    cachedBalance: string,
  ) {
    super(
      "LEDGER_BALANCE_MISMATCH",
      `Ledger balance mismatch for ${dealerCode}: ledger=${ledgerBalance} cache=${cachedBalance}`,
    );
    this.name = "LedgerBalanceMismatchError";
    this.dealerCode = dealerCode;
    this.ledgerBalance = ledgerBalance;
    this.cachedBalance = cachedBalance;
  }
}

/**
 * Raised whenever code attempts to update or delete a historical ledger row.
 *
 * Used by helper guards. The database schema itself does not enforce
 * immutability — this guard is the runtime backstop until a database-level
 * rule is added.
 */
export class LedgerImmutabilityError extends LedgerError {
  readonly entryId: string;

  constructor(entryId: string, operation: string) {
    super(
      "LEDGER_IMMUTABILITY_VIOLATION",
      `Ledger entry ${entryId} is immutable and cannot be ${operation}. Post a compensating reversal instead.`,
    );
    this.name = "LedgerImmutabilityError";
    this.entryId = entryId;
  }
}

/**
 * Raised when reconciliation detects a drift between the cached
 * `Dealer.currentBalance` and the ledger running balance.
 */
export class LedgerReconciliationError extends LedgerError {
  readonly dealerCode: string;
  readonly cachedBalance: string;
  readonly ledgerBalance: string;
  readonly drift: string;

  constructor(
    dealerCode: string,
    cachedBalance: string,
    ledgerBalance: string,
    drift: string,
  ) {
    super(
      "LEDGER_RECONCILIATION_DRIFT",
      `Ledger reconciliation drift for ${dealerCode}: cache=${cachedBalance} ledger=${ledgerBalance} drift=${drift}`,
    );
    this.name = "LedgerReconciliationError";
    this.dealerCode = dealerCode;
    this.cachedBalance = cachedBalance;
    this.ledgerBalance = ledgerBalance;
    this.drift = drift;
  }
}
