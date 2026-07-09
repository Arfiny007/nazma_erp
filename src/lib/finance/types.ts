import type {
  FinancialReferenceType,
  LedgerPostingType,
  Prisma,
} from "@prisma/client";

/**
 * Financial posting boundary types.
 *
 * All balance mutations flow through the posting service so future Ledger,
 * Collection, Credit Note, and Return modules extend the same abstraction.
 *
 * PHASE_07A extends every posting input with optional ledger metadata
 * (`postingType`, `postingKey`, `transactionDate`). The current posting
 * service does not yet consume these fields — PHASE_07B wires them into
 * `createLedgerEntry` without further signature changes.
 */

export type { FinancialReferenceType, LedgerPostingType };

export const FINANCIAL_REFERENCE_INVOICE: FinancialReferenceType = "Invoice";
export const FINANCIAL_REFERENCE_COLLECTION: FinancialReferenceType = "Collection";

/** AuditLog action recorded when dealer receivable balance increases. */
export const DEALER_BALANCE_UPDATED_ACTION = "DEALER_BALANCE_UPDATED" as const;

/** AuditLog action recorded when dealer receivable balance decreases (collection). */
export const DEALER_BALANCE_DECREASED_ACTION = "DEALER_BALANCE_DECREASED" as const;

export const COLLECTION_CREATED_ACTION = "COLLECTION_CREATED" as const;
export const COLLECTION_CONFIRMED_ACTION = "COLLECTION_CONFIRMED" as const;
export const COLLECTION_ALLOCATED_ACTION = "COLLECTION_ALLOCATED" as const;
export const COLLECTION_DEALLOCATED_ACTION = "COLLECTION_DEALLOCATED" as const;
export const COLLECTION_REVERSED_ACTION = "COLLECTION_REVERSED" as const;
export const COLLECTION_REVERSED_MISALLOCATION_ACTION =
  "COLLECTION_REVERSED_MISALLOCATION" as const;

export interface ReceivablePostingInput {
  tx: Prisma.TransactionClient;
  dealerCode: string;
  amount: Prisma.Decimal;
  /** Balance captured under dealer row lock — used for audit and idempotent math. */
  previousBalance: Prisma.Decimal;
  userId: string;
  referenceType: FinancialReferenceType;
  referenceId: string;
  referenceNo: string;
  /**
   * Ledger posting metadata (PHASE_07A extension point).
   *
   * When omitted, the posting service derives sensible defaults
   * (`postingType = Issue` for `postReceivableIncrease`,
   * `transactionDate = now()`). PHASE_07B consumes these fields inside
   * `createLedgerEntry` — no further caller changes required.
   */
  postingType?: LedgerPostingType;
  transactionDate?: Date;
  /** Optional idempotency override — see `buildLedgerPostingKey`. */
  postingKey?: string;
  /** Optional link to an existing entry that this posting compensates. */
  reversesEntryId?: string;
  metadata?: Record<string, string>;
}

export interface ReceivablePostingResult {
  previousBalance: Prisma.Decimal;
  newBalance: Prisma.Decimal;
}

export interface ReceivableDecreasePostingInput {
  tx: Prisma.TransactionClient;
  dealerCode: string;
  amount: Prisma.Decimal;
  /** Balance captured under dealer row lock. */
  previousBalance: Prisma.Decimal;
  userId: string;
  referenceType: FinancialReferenceType;
  referenceId: string;
  referenceNo: string;
  collectionId: string;
  collectionNo: string;
  /** When false, only invoice/collection pool updates — cash already posted on confirm. */
  applyDealerBalance?: boolean;
  /**
   * Ledger posting metadata (PHASE_07A extension point). Same semantics as
   * `ReceivablePostingInput` — PHASE_07B consumes.
   */
  postingType?: LedgerPostingType;
  transactionDate?: Date;
  postingKey?: string;
  reversesEntryId?: string;
  metadata?: Record<string, string>;
}

export interface ReceivableDecreasePostingResult {
  previousBalance: Prisma.Decimal;
  newBalance: Prisma.Decimal;
  allocatedAmount: Prisma.Decimal;
  unallocatedAmount: Prisma.Decimal;
}
