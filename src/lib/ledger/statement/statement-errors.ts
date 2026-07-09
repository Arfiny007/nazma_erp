/**
 * Error types for the Dealer Statement read engine — PHASE_07D1.
 *
 * These are domain errors raised by pure validation/query code, distinct
 * from the posting-side errors in `ledger-errors.ts`. Nothing in this file
 * (or the module it belongs to) ever mutates data.
 *
 * @see ADR-029
 */

export class DealerStatementError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DealerStatementError";
    this.code = code;
  }
}

/** Raised when the requested dealer does not exist. */
export class DealerNotFoundError extends DealerStatementError {
  readonly dealerCode: string;

  constructor(dealerCode: string) {
    super("DEALER_NOT_FOUND", `Dealer not found: ${dealerCode}`);
    this.name = "DealerNotFoundError";
    this.dealerCode = dealerCode;
  }
}

/** Raised when `fromDate` is after `toDate`, or either is not a valid date. */
export class InvalidDateRangeError extends DealerStatementError {
  constructor(message = "fromDate must not be after toDate") {
    super("INVALID_DATE_RANGE", message);
    this.name = "InvalidDateRangeError";
  }
}

/** Raised when `page` or `pageSize` fall outside the allowed bounds. */
export class InvalidPaginationError extends DealerStatementError {
  constructor(message: string) {
    super("INVALID_PAGINATION", message);
    this.name = "InvalidPaginationError";
  }
}
