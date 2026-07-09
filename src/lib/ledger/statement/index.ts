/**
 * Public surface of the Dealer Statement read engine — PHASE_07D1.
 *
 * READ ONLY. Import from this barrel (never reach into the internal files
 * directly) so future PDF/Excel/Email/Reporting consumers all share the
 * exact same contract.
 *
 * @see ADR-029
 */

export {
  getDealerStatement,
  getDealerStatementSummary,
} from "./dealer-statement-service";

export {
  DealerNotFoundError,
  DealerStatementError,
  InvalidDateRangeError,
  InvalidPaginationError,
} from "./statement-errors";

export {
  buildStatementDescription,
  mapLedgerEntryToStatementRow,
} from "./statement-mapper";

export {
  aggregateLedgerTotalsForDealer,
  countLedgerEntriesForDealer,
  findDealerForStatement,
  findLastLedgerEntryBefore,
  findLedgerDateBoundsForDealer,
  findLedgerEntriesPageForDealer,
  findOpeningBalanceForDealer,
} from "./statement-query";
export type {
  StatementDateRangeParams,
  StatementDealerRow,
  StatementLedgerDateBounds,
  StatementLedgerEntryRow,
  StatementLedgerTotals,
  StatementOpeningBalanceRow,
  StatementReadClient,
} from "./statement-query";

export type {
  DealerStatementDateRange,
  DealerStatementMeta,
  DealerStatementResult,
  DealerStatementSummaryResult,
  GetDealerStatementParams,
  GetDealerStatementSummaryParams,
  StatementLedgerIntegrity,
  StatementPagination,
  StatementRow,
  StatementTotals,
} from "./statement-types";
export {
  STATEMENT_DEFAULT_PAGE_SIZE,
  STATEMENT_MAX_PAGE_SIZE,
  STATEMENT_MIN_PAGE_SIZE,
} from "./statement-types";

export {
  assertDealerExists,
  assertValidDateRange,
  assertValidPagination,
} from "./statement-validation";
