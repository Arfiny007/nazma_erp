import type { Prisma } from "@prisma/client";

/**
 * Financial posting boundary types.
 *
 * All balance mutations flow through the posting service so future Ledger,
 * Collection, Credit Note, and Return modules extend the same abstraction.
 */

export const FINANCIAL_REFERENCE_INVOICE = "Invoice" as const;

export type FinancialReferenceType = typeof FINANCIAL_REFERENCE_INVOICE;

/** AuditLog action recorded when dealer receivable balance increases. */
export const DEALER_BALANCE_UPDATED_ACTION = "DEALER_BALANCE_UPDATED" as const;

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
