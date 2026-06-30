import type { FinancialReferenceType, Prisma } from "@prisma/client";

/**
 * Financial posting boundary types.
 *
 * All balance mutations flow through the posting service so future Ledger,
 * Collection, Credit Note, and Return modules extend the same abstraction.
 */

export type { FinancialReferenceType };

export const FINANCIAL_REFERENCE_INVOICE: FinancialReferenceType = "Invoice";

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
  metadata?: Record<string, string>;
}

export interface ReceivableDecreasePostingResult {
  previousBalance: Prisma.Decimal;
  newBalance: Prisma.Decimal;
  allocatedAmount: Prisma.Decimal;
  unallocatedAmount: Prisma.Decimal;
}
