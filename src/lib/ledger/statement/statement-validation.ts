import {
  DealerNotFoundError,
  InvalidDateRangeError,
  InvalidPaginationError,
} from "./statement-errors";
import {
  STATEMENT_MAX_PAGE_SIZE,
  STATEMENT_MIN_PAGE_SIZE,
} from "./statement-types";

/**
 * Pure validation helpers for the Dealer Statement read engine.
 *
 * No I/O here — these functions only inspect already-fetched values or
 * caller-supplied primitives and throw the corresponding `statement-errors`
 * subclass on failure. Keeping validation pure makes it trivial to unit test
 * without a database.
 *
 * @see ADR-029
 */

/**
 * Asserts a dealer lookup succeeded, narrowing the type from `T | null`.
 * Used right after `findDealerForStatement()` in the service layer.
 */
export function assertDealerExists<T>(dealer: T | null, dealerCode: string): T {
  if (!dealer) {
    throw new DealerNotFoundError(dealerCode);
  }
  return dealer;
}

/**
 * Validates an optional date-range filter. Both bounds are optional; when
 * both are present, `fromDate` must not be after `toDate`.
 */
export function assertValidDateRange(
  fromDate?: Date | null,
  toDate?: Date | null,
): void {
  if (fromDate && Number.isNaN(fromDate.getTime())) {
    throw new InvalidDateRangeError("fromDate is not a valid date");
  }
  if (toDate && Number.isNaN(toDate.getTime())) {
    throw new InvalidDateRangeError("toDate is not a valid date");
  }
  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw new InvalidDateRangeError();
  }
}

/**
 * Validates pagination parameters against the module's fixed bounds
 * (`STATEMENT_MIN_PAGE_SIZE`..`STATEMENT_MAX_PAGE_SIZE`).
 */
export function assertValidPagination(page: number, pageSize: number): void {
  if (!Number.isInteger(page) || page < 1) {
    throw new InvalidPaginationError(
      `page must be a positive integer, got ${page}`,
    );
  }
  if (
    !Number.isInteger(pageSize) ||
    pageSize < STATEMENT_MIN_PAGE_SIZE ||
    pageSize > STATEMENT_MAX_PAGE_SIZE
  ) {
    throw new InvalidPaginationError(
      `pageSize must be between ${STATEMENT_MIN_PAGE_SIZE} and ${STATEMENT_MAX_PAGE_SIZE}, got ${pageSize}`,
    );
  }
}
