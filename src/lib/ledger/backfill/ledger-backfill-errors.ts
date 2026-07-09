/**
 * Error types for the Ledger Backfill Discovery module — PHASE_07E1.
 *
 * Discovery is read-only; these errors cover query/validation failures only.
 *
 * @see ADR-032
 */

export class LedgerBackfillError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "LedgerBackfillError";
    this.code = code;
  }
}

/** Raised when discovery input fails structural validation. */
export class LedgerBackfillValidationError extends LedgerBackfillError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message);
    this.name = "LedgerBackfillValidationError";
  }
}

/** Raised when a dealer is not eligible for historical replay. */
export class LedgerReplayNotEligibleError extends LedgerBackfillError {
  readonly eligibility: string;

  constructor(eligibility: string, message: string) {
    super("NOT_ELIGIBLE", message);
    this.name = "LedgerReplayNotEligibleError";
    this.eligibility = eligibility;
  }
}

/** Raised when replay parity check fails — transaction rolls back. */
export class LedgerReplayParityError extends LedgerBackfillError {
  readonly dealerCode: string;
  readonly ledgerBalance: string;
  readonly dealerBalance: string;

  constructor(
    dealerCode: string,
    ledgerBalance: string,
    dealerBalance: string,
  ) {
    super(
      "PARITY_MISMATCH",
      `Ledger replay parity mismatch for ${dealerCode}: ledger=${ledgerBalance}, dealer=${dealerBalance}`,
    );
    this.name = "LedgerReplayParityError";
    this.dealerCode = dealerCode;
    this.ledgerBalance = ledgerBalance;
    this.dealerBalance = dealerBalance;
  }
}

/** Raised when existing ledger chain integrity is corrupted. */
export class LedgerReplayChainCorruptedError extends LedgerBackfillError {
  constructor(dealerCode: string) {
    super(
      "CORRUPTED_CHAIN",
      `Ledger chain integrity failed for ${dealerCode}`,
    );
    this.name = "LedgerReplayChainCorruptedError";
  }
}
