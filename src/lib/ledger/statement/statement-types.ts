import type { FinancialReferenceType, LedgerPostingType } from "@prisma/client";
import { Prisma } from "@prisma/client";

/**
 * Internal domain types for the Dealer Statement read engine — PHASE_07D1.
 *
 * These types carry `Prisma.Decimal` for monetary values, matching the
 * project's financial rules (never `number`/`float` for money). The
 * Server Action boundary (`src/lib/actions/ledger-statement/`) converts
 * these into transport-safe DTOs with string amounts — see
 * `src/types/ledger-statement.ts`.
 *
 * This module is READ ONLY. Nothing here mutates `LedgerEntry`, `Dealer`,
 * `Invoice`, `Collection`, or `OpeningBalance`.
 *
 * @see ADR-029
 */

export const STATEMENT_DEFAULT_PAGE_SIZE = 50;
export const STATEMENT_MIN_PAGE_SIZE = 1;
export const STATEMENT_MAX_PAGE_SIZE = 200;

/* -------------------------------------------------------------------------- */
/*                                   Inputs                                   */
/* -------------------------------------------------------------------------- */

export interface GetDealerStatementParams {
  dealerCode: string;
  /** Inclusive lower bound on `LedgerEntry.transactionDate`. */
  fromDate?: Date;
  /** Inclusive upper bound on `LedgerEntry.transactionDate`. */
  toDate?: Date;
  page: number;
  pageSize: number;
}

export interface GetDealerStatementSummaryParams {
  dealerCode: string;
  fromDate?: Date;
  toDate?: Date;
}

/* -------------------------------------------------------------------------- */
/*                                    Rows                                    */
/* -------------------------------------------------------------------------- */

/**
 * A single statement line. `runningBalance` is read verbatim from
 * `LedgerEntry.balance` — it is NEVER recomputed by this engine.
 */
export interface StatementRow {
  id: string;
  transactionDate: Date;
  postingDate: Date;
  postingType: LedgerPostingType;
  referenceType: FinancialReferenceType;
  referenceId: string;
  referenceNo: string;
  description: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  /** Verbatim copy of `LedgerEntry.balance`. Never recalculated. */
  runningBalance: Prisma.Decimal;
  createdById: string | null;
  createdByName: string | null;
  isOpeningBalance: boolean;
}

export interface StatementTotals {
  totalDebit: Prisma.Decimal;
  totalCredit: Prisma.Decimal;
  netMovement: Prisma.Decimal;
  /** Number of ledger entries across the ENTIRE filtered range, not just the current page. */
  entryCount: number;
}

export interface StatementPagination {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface DealerStatementDateRange {
  fromDate: Date | null;
  toDate: Date | null;
}

export interface StatementLedgerIntegrity {
  /** Running-balance chain is internally consistent (prior + debit − credit). */
  isChainValid: boolean;
  /** Replay from zero matches the last entry balance. */
  isReplayValid: boolean;
  /** Last entry balance matches `Dealer.currentBalance`. */
  isCacheValid: boolean;
  /** All three checks pass — safe for downstream reporting consumers. */
  isConsistent: boolean;
}

export interface DealerStatementMeta {
  dealerCode: string;
  dealerName: string;
  /** `Dealer.currentBalance` at read time — the cached balance, not recomputed. */
  currentBalance: Prisma.Decimal;
  creditLimit: Prisma.Decimal;
  /** True only when the dealer's `OpeningBalance` has been posted (status `Locked`). */
  hasOpeningBalance: boolean;
  openingBalanceAmount: Prisma.Decimal | null;
  openingBalanceEffectiveDate: Date | null;
  openingBalanceStatus: string | null;
  dateRange: DealerStatementDateRange;
  /** Read-only ledger integrity snapshot — never mutates data on failure. */
  ledgerIntegrity: StatementLedgerIntegrity;
  generatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                                   Results                                  */
/* -------------------------------------------------------------------------- */

export interface DealerStatementResult {
  meta: DealerStatementMeta;
  /**
   * Running balance carried into the visible date-filtered window — the
   * `balance` of the last `LedgerEntry` strictly before `fromDate`. Zero when
   * no `fromDate` filter is applied or no prior entry exists. Read verbatim
   * from `LedgerEntry.balance`; never recomputed.
   */
  openingBalanceForRange: Prisma.Decimal;
  rows: StatementRow[];
  totals: StatementTotals;
  pagination: StatementPagination;
}

export interface DealerStatementSummaryResult {
  dealerCode: string;
  dealerName: string;
  currentBalance: Prisma.Decimal;
  creditLimit: Prisma.Decimal;
  totalDebit: Prisma.Decimal;
  totalCredit: Prisma.Decimal;
  entryCount: number;
  firstEntryDate: Date | null;
  lastEntryDate: Date | null;
  hasOpeningBalance: boolean;
  dateRange: DealerStatementDateRange;
}
