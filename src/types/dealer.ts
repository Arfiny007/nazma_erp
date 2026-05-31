import type { Dealer } from "@prisma/client";

/**
 * Domain types for the Dealer Management module.
 *
 * Prisma's `Decimal` type is not serializable across the Server/Client
 * boundary, so every monetary value that leaves the data layer is exposed as a
 * fixed-precision decimal string (e.g. "150000.00"). UI code is responsible for
 * locale-aware formatting of these strings.
 */

/** The raw persistence record as returned by Prisma. */
export type DealerRecord = Dealer;

/* -------------------------------------------------------------------------- */
/*                              Credit utilization                            */
/* -------------------------------------------------------------------------- */

/**
 * Credit utilization severity:
 * - `green`  -> 0% - 84%   (healthy)
 * - `yellow` -> 85% - 99%  (approaching limit)
 * - `red`    -> 100%+      (at or over limit)
 */
export type CreditStatusLevel = "green" | "yellow" | "red";

export interface CreditUtilization {
  /** Configured credit limit as a decimal string. */
  creditLimit: string;
  /** Outstanding balance as a decimal string. */
  currentBalance: string;
  /** `creditLimit - currentBalance` as a decimal string (may be negative). */
  availableCredit: string;
  /** Utilization percentage, rounded to two decimals (0 when no limit set). */
  utilizationPercent: number;
  /** Severity bucket derived from the utilization percentage. */
  status: CreditStatusLevel;
  /** True when the balance has reached or exceeded the credit limit. */
  isOverLimit: boolean;
}

/* -------------------------------------------------------------------------- */
/*                          Data transfer / view models                      */
/* -------------------------------------------------------------------------- */

/** Serializable dealer projection safe to return from server actions. */
export interface DealerDTO {
  id: string;
  dealerCode: string;
  companyName: string;
  proprietorName: string | null;
  mobile: string;
  email: string | null;
  address: string;
  district: string;
  territory: string;
  creditLimit: string;
  currentBalance: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Pre-computed credit utilization for convenient rendering. */
  credit: CreditUtilization;
}

/* -------------------------------------------------------------------------- */
/*                              Listing & paging                              */
/* -------------------------------------------------------------------------- */

export const DEALER_SORT_FIELDS = [
  "dealerCode",
  "companyName",
  "createdAt",
  "currentBalance",
  "creditLimit",
] as const;

export type DealerSortField = (typeof DEALER_SORT_FIELDS)[number];

export type SortOrder = "asc" | "desc";

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/* -------------------------------------------------------------------------- */
/*                            Typed error responses                           */
/* -------------------------------------------------------------------------- */

export type DealerErrorCode =
  | "VALIDATION_ERROR"
  | "DEALER_NOT_FOUND"
  | "DUPLICATE_DEALER_CODE"
  | "DUPLICATE_MOBILE"
  | "DEALER_HAS_DEPENDENCIES"
  | "INTERNAL_ERROR";

/** A single field-level validation failure carrying a localization key. */
export interface FieldError {
  field: string;
  messageKey: string;
}

/**
 * Typed, serializable error envelope. `messageKey` is always a localization
 * key (never a hard-coded human string) so the UI layer can translate it.
 */
export interface DealerError {
  code: DealerErrorCode;
  messageKey: string;
  fieldErrors?: FieldError[];
}

/** Discriminated union returned by every dealer server action. */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: DealerError };
