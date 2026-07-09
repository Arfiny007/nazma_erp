import type { FinancialReferenceType, LedgerPostingType } from "@prisma/client";

import type { CreditUtilization } from "@/types/dealer";

/**
 * Transport DTOs for the Dealer Subledger Foundation — PHASE_07D1.
 *
 * Prisma's `Decimal` is not serializable across the Server/Client boundary,
 * so every monetary value leaving `src/lib/ledger/statement/` is exposed as
 * a fixed-precision decimal string (e.g. "1500.00"). See
 * `src/lib/actions/ledger-statement/mappers.ts` for the Decimal -> string
 * conversion.
 */

export type { FinancialReferenceType, LedgerPostingType };

/* -------------------------------------------------------------------------- */
/*                          Data transfer / view models                      */
/* -------------------------------------------------------------------------- */

/** A single statement line. `runningBalance` comes verbatim from `LedgerEntry.balance`. */
export interface StatementRowDTO {
  id: string;
  transactionDate: string;
  postingDate: string;
  postingType: LedgerPostingType;
  referenceType: FinancialReferenceType;
  referenceId: string;
  referenceNo: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
  createdById: string | null;
  createdByName: string | null;
  isOpeningBalance: boolean;
}

export interface StatementTotalsDTO {
  totalDebit: string;
  totalCredit: string;
  netMovement: string;
  entryCount: number;
}

export interface StatementDateRangeDTO {
  fromDate: string | null;
  toDate: string | null;
}

export interface StatementLedgerIntegrityDTO {
  isChainValid: boolean;
  isReplayValid: boolean;
  isCacheValid: boolean;
  isConsistent: boolean;
}

export interface DealerStatementMetaDTO {
  dealerCode: string;
  dealerName: string;
  currentBalance: string;
  creditLimit: string;
  hasOpeningBalance: boolean;
  openingBalanceAmount: string | null;
  openingBalanceEffectiveDate: string | null;
  openingBalanceStatus: string | null;
  dateRange: StatementDateRangeDTO;
  ledgerIntegrity: StatementLedgerIntegrityDTO;
  generatedAt: string;
}

export interface StatementPaginationDTO {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

/** Full paginated Dealer Statement — the primary payload of `getDealerStatement()`. */
export interface DealerStatementDTO {
  meta: DealerStatementMetaDTO;
  openingBalanceForRange: string;
  rows: StatementRowDTO[];
  totals: StatementTotalsDTO;
  pagination: StatementPaginationDTO;
}

/** Compact, non-paginated statement summary — `getDealerStatementSummary()`. */
export interface DealerStatementSummaryDTO {
  dealerCode: string;
  dealerName: string;
  currentBalance: string;
  creditLimit: string;
  credit: CreditUtilization;
  totalDebit: string;
  totalCredit: string;
  entryCount: number;
  firstEntryDate: string | null;
  lastEntryDate: string | null;
  hasOpeningBalance: boolean;
  dateRange: StatementDateRangeDTO;
}

/* -------------------------------------------------------------------------- */
/*                            Typed error responses                           */
/* -------------------------------------------------------------------------- */

export type LedgerStatementErrorCode =
  | "VALIDATION_ERROR"
  | "DEALER_NOT_FOUND"
  | "INVALID_DATE_RANGE"
  | "INVALID_PAGINATION"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

export interface FieldError {
  field: string;
  messageKey: string;
}

export interface LedgerStatementError {
  code: LedgerStatementErrorCode;
  messageKey: string;
  fieldErrors?: FieldError[];
}

/** Discriminated union returned by every ledger statement server action. */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: LedgerStatementError };
