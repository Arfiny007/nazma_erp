import { DeliveryChallanStatus } from "@prisma/client";

import type { InvoiceErrorCode } from "@/types/invoice";

/**
 * Invoice issuance workflow guards.
 *
 * Credit-limit validation is delegated to `wouldExceedCreditLimit` at issue
 * time. Challan dispatch never triggers these checks (ADR-011).
 */

export class InvoiceWorkflowError extends Error {
  readonly code: InvoiceErrorCode;
  readonly messageKey: string;

  constructor(code: InvoiceErrorCode, messageKey: string) {
    super(code);
    this.name = "InvoiceWorkflowError";
    this.code = code;
    this.messageKey = messageKey;
  }
}

/** Rejects invoice issue when the parent challan is not Confirmed. */
export function assertChallanConfirmedForInvoice(
  status: DeliveryChallanStatus,
): void {
  if (status === DeliveryChallanStatus.Draft) {
    throw new InvoiceWorkflowError(
      "CHALLAN_NOT_CONFIRMED",
      "invoice.error.challanNotConfirmed",
    );
  }
  if (status === DeliveryChallanStatus.Cancelled) {
    throw new InvoiceWorkflowError(
      "CHALLAN_CANCELLED",
      "invoice.error.challanCancelled",
    );
  }
}

/** Rejects duplicate invoice for the same delivery challan. */
export function assertNoExistingInvoice(hasInvoice: boolean): void {
  if (hasInvoice) {
    throw new InvoiceWorkflowError(
      "INVOICE_ALREADY_EXISTS",
      "invoice.error.alreadyExists",
    );
  }
}

/** Rejects invoice issue when the challan has no line items. */
export function assertChallanHasItemsForInvoice(itemCount: number): void {
  if (itemCount < 1) {
    throw new InvoiceWorkflowError("CHALLAN_EMPTY", "invoice.error.challanEmpty");
  }
}
