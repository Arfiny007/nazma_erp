import { InvoiceStatus, Prisma } from "@prisma/client";

import {
  computeInvoiceOutstanding,
  resolveInvoiceStatusAfterAllocation,
  CollectionWorkflowError,
} from "@/lib/collections/workflow";
import { FINANCIAL_REFERENCE_INVOICE } from "@/lib/finance/types";

/**
 * Resolves a financial reference for allocation.
 *
 * Handlers are registered per {@link FinancialReferenceType}. Invoice is
 * supported today; other types throw until their phases land.
 */

export interface ResolvedFinancialReference {
  referenceType: typeof FINANCIAL_REFERENCE_INVOICE;
  referenceId: string;
  referenceLabel: string;
  dealerCode: string;
  outstanding: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  collectionReceived: Prisma.Decimal;
  currentDue: Prisma.Decimal;
  status: InvoiceStatus;
}

export async function resolveFinancialReference(
  tx: Prisma.TransactionClient,
  referenceType: string,
  referenceId: string,
  expectedDealerCode: string,
): Promise<ResolvedFinancialReference> {
  if (referenceType === FINANCIAL_REFERENCE_INVOICE) {
    const invoice = await tx.invoice.findUnique({
      where: { id: referenceId },
      select: {
        id: true,
        invoiceNo: true,
        dealerCode: true,
        grandTotal: true,
        currentDue: true,
        collectionReceived: true,
        status: true,
      },
    });

    if (!invoice) {
      throw new ReferenceNotFoundError(referenceType, referenceId);
    }

    if (invoice.dealerCode !== expectedDealerCode) {
      throw new ReferenceDealerMismatchError(
        referenceType,
        referenceId,
        expectedDealerCode,
        invoice.dealerCode,
      );
    }

    return {
      referenceType: FINANCIAL_REFERENCE_INVOICE,
      referenceId: invoice.id,
      referenceLabel: invoice.invoiceNo,
      dealerCode: invoice.dealerCode,
      outstanding: computeInvoiceOutstanding(
        invoice.grandTotal,
        invoice.collectionReceived,
      ),
      grandTotal: invoice.grandTotal,
      collectionReceived: invoice.collectionReceived,
      currentDue: invoice.currentDue,
      status: invoice.status,
    };
  }

  throw new UnsupportedReferenceTypeError(referenceType);
}

export class ReferenceNotFoundError extends Error {
  readonly referenceType: string;
  readonly referenceId: string;

  constructor(referenceType: string, referenceId: string) {
    super(`Reference not found: ${referenceType}/${referenceId}`);
    this.name = "ReferenceNotFoundError";
    this.referenceType = referenceType;
    this.referenceId = referenceId;
  }
}

export class ReferenceDealerMismatchError extends Error {
  constructor(
    readonly referenceType: string,
    readonly referenceId: string,
    readonly expectedDealerCode: string,
    readonly actualDealerCode: string,
  ) {
    super(
      `Reference dealer mismatch for ${referenceType}/${referenceId}: expected ${expectedDealerCode}, got ${actualDealerCode}`,
    );
    this.name = "ReferenceDealerMismatchError";
  }
}

export class UnsupportedReferenceTypeError extends Error {
  constructor(readonly referenceType: string) {
    super(`Unsupported financial reference type: ${referenceType}`);
    this.name = "UnsupportedReferenceTypeError";
  }
}

export async function applyInvoiceAllocation(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  amount: Prisma.Decimal,
): Promise<void> {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      grandTotal: true,
      currentDue: true,
      collectionReceived: true,
    },
  });

  if (!invoice) {
    throw new ReferenceNotFoundError(FINANCIAL_REFERENCE_INVOICE, invoiceId);
  }

  const newCollectionReceived = invoice.collectionReceived.plus(amount);

  if (newCollectionReceived.greaterThan(invoice.grandTotal)) {
    throw new CollectionWorkflowError(
      "ALLOCATION_EXCEEDS_RECEIVED",
      "collection.error.allocationExceedsOutstanding",
    );
  }

  const newCurrentDue = invoice.currentDue.minus(amount);
  const newStatus = resolveInvoiceStatusAfterAllocation(
    invoice.grandTotal,
    newCollectionReceived,
  );

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      collectionReceived: newCollectionReceived,
      currentDue: newCurrentDue,
      status: newStatus,
    },
  });
}

export async function reverseInvoiceAllocation(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  amount: Prisma.Decimal,
): Promise<void> {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      grandTotal: true,
      currentDue: true,
      collectionReceived: true,
    },
  });

  if (!invoice) {
    throw new ReferenceNotFoundError(FINANCIAL_REFERENCE_INVOICE, invoiceId);
  }

  const newCollectionReceived = invoice.collectionReceived.minus(amount);
  const newCurrentDue = invoice.currentDue.plus(amount);
  const newStatus = resolveInvoiceStatusAfterAllocation(
    invoice.grandTotal,
    newCollectionReceived,
  );

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      collectionReceived: newCollectionReceived,
      currentDue: newCurrentDue,
      status: newStatus,
    },
  });
}
