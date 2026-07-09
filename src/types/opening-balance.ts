import type { OpeningBalanceSource, OpeningBalanceStatus } from "@prisma/client";

/**
 * Client-facing domain types for the Financial Initialization Platform
 * (Opening Balance workflow — PHASE_07C).
 *
 * Monetary values are exposed as fixed-precision decimal strings for safe
 * Server/Client transport, matching the Invoice/Collection DTO convention
 * (see ADR-014, `src/types/invoice.ts`).
 */

export type { OpeningBalanceSource, OpeningBalanceStatus };

export interface OpeningBalanceDTO {
  id: string;
  dealerCode: string;
  dealerName: string;
  /** Signed decimal string — positive = dealer owes, negative = advance credit. */
  amount: string;
  effectiveDate: string;
  status: OpeningBalanceStatus;
  source: OpeningBalanceSource;
  referenceNo: string | null;
  remarks: string | null;
  createdById: string;
  createdByName: string;
  validatedAt: string | null;
  validatedById: string | null;
  postedAt: string | null;
  postedById: string | null;
  lockedAt: string | null;
  ledgerEntryId: string | null;
  postingKey: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Row projection for the Dealer Selection wizard step. */
export interface UninitializedDealerDTO {
  id: string;
  dealerCode: string;
  companyName: string;
  district: string;
  territory: string;
  currentBalance: string;
  creditLimit: string;
}

/**
 * Initialization status for a single dealer — the backbone of
 * `getInitializationStatus()`. `isInitialized` is true only when
 * `openingBalance.status === "Locked"`; a dealer with an in-progress Draft /
 * Validated record is NOT yet initialized (but cannot start a second one).
 */
export interface InitializationStatusDTO {
  dealerCode: string;
  dealerName: string;
  isInitialized: boolean;
  openingBalance: OpeningBalanceDTO | null;
}

export interface OpeningBalanceFieldError {
  field: string;
  messageKey: string;
}

export type OpeningBalanceErrorCode =
  | "VALIDATION_ERROR"
  | "DEALER_NOT_FOUND"
  | "ALREADY_INITIALIZED"
  | "RECORD_NOT_FOUND"
  | "INVALID_STATE_TRANSITION"
  | "IMMUTABLE_RECORD"
  | "POSTING_KEY_CONFLICT"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

export interface OpeningBalanceError {
  code: OpeningBalanceErrorCode;
  messageKey: string;
  fieldErrors?: OpeningBalanceFieldError[];
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: OpeningBalanceError };

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Result of the "Validation" wizard step when business rules reject the draft. */
export interface OpeningBalanceValidationResultDTO {
  valid: boolean;
  issues: OpeningBalanceFieldError[];
  openingBalance: OpeningBalanceDTO | null;
}

/** Result of the "Posting" wizard step. */
export interface OpeningBalancePostResultDTO {
  openingBalance: OpeningBalanceDTO;
  /** True when the record was already Locked — an idempotent replay, not a fresh post. */
  alreadyPosted: boolean;
}
