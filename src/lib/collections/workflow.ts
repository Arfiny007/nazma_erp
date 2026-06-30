import { CollectionStatus, InvoiceStatus, Prisma } from "@prisma/client";

import type { CollectionErrorCode } from "@/types/collection";

/**
 * Collection lifecycle guards.
 *
 * Draft → Confirmed → PartiallyAllocated / Allocated → Reversed
 *
 * @see ADR-019, ADR-020
 */

export class CollectionWorkflowError extends Error {
  readonly code: CollectionErrorCode;
  readonly messageKey: string;

  constructor(code: CollectionErrorCode, messageKey: string) {
    super(code);
    this.name = "CollectionWorkflowError";
    this.code = code;
    this.messageKey = messageKey;
  }
}

const EDITABLE_STATUSES: ReadonlySet<CollectionStatus> = new Set([
  CollectionStatus.Draft,
]);

const ALLOCATABLE_STATUSES: ReadonlySet<CollectionStatus> = new Set([
  CollectionStatus.Confirmed,
  CollectionStatus.PartiallyAllocated,
  CollectionStatus.Allocated,
]);

const REVERSIBLE_STATUSES: ReadonlySet<CollectionStatus> = new Set([
  CollectionStatus.Confirmed,
  CollectionStatus.PartiallyAllocated,
  CollectionStatus.Allocated,
]);

export function assertCollectionIsDraft(status: CollectionStatus): void {
  if (!EDITABLE_STATUSES.has(status)) {
    throw new CollectionWorkflowError(
      "INVALID_STATUS_TRANSITION",
      "collection.error.notDraft",
    );
  }
}

export function assertCollectionCanBeUpdated(status: CollectionStatus): void {
  assertCollectionIsDraft(status);
}

export function assertCollectionCanBeCancelled(status: CollectionStatus): void {
  assertCollectionIsDraft(status);
}

export function assertCollectionCanBeConfirmed(status: CollectionStatus): void {
  if (status === CollectionStatus.Confirmed) {
    return;
  }
  if (status !== CollectionStatus.Draft) {
    throw new CollectionWorkflowError(
      "INVALID_STATUS_TRANSITION",
      "collection.error.cannotConfirm",
    );
  }
}

export function assertCollectionCanBeAllocated(status: CollectionStatus): void {
  if (!ALLOCATABLE_STATUSES.has(status)) {
    if (status === CollectionStatus.Draft) {
      throw new CollectionWorkflowError(
        "COLLECTION_NOT_CONFIRMED",
        "collection.error.notConfirmed",
      );
    }
    if (status === CollectionStatus.Reversed) {
      throw new CollectionWorkflowError(
        "COLLECTION_ALREADY_REVERSED",
        "collection.error.alreadyReversed",
      );
    }
    throw new CollectionWorkflowError(
      "INVALID_STATUS_TRANSITION",
      "collection.error.cannotAllocate",
    );
  }
}

export function assertCollectionCanBeReversed(status: CollectionStatus): void {
  if (status === CollectionStatus.Reversed) {
    throw new CollectionWorkflowError(
      "COLLECTION_ALREADY_REVERSED",
      "collection.error.alreadyReversed",
    );
  }
  if (!REVERSIBLE_STATUSES.has(status)) {
    throw new CollectionWorkflowError(
      "INVALID_STATUS_TRANSITION",
      "collection.error.cannotReverse",
    );
  }
}

export function assertPositiveAllocationAmount(amount: Prisma.Decimal): void {
  if (amount.lessThanOrEqualTo(0)) {
    throw new CollectionWorkflowError(
      "VALIDATION_ERROR",
      "collection.error.allocationMustBePositive",
    );
  }
}

/**
 * Remaining invoice balance available for collection allocation.
 *
 * Uses `grandTotal − collectionReceived`, not `currentDue − collectionReceived`.
 * `currentDue` is a cumulative statement snapshot (`previousDue + grandTotal` at
 * issue, then reduced per allocation); pairing it with `collectionReceived` would
 * double-count each payment and cap allocations incorrectly.
 */
export function computeInvoiceOutstanding(
  grandTotal: Prisma.Decimal,
  collectionReceived: Prisma.Decimal,
): Prisma.Decimal {
  const outstanding = grandTotal.sub(collectionReceived);
  return outstanding.lessThan(0) ? new Prisma.Decimal(0) : outstanding;
}

export function assertInvoiceAllocatable(status: InvoiceStatus): void {
  if (status === InvoiceStatus.Paid) {
    throw new CollectionWorkflowError(
      "VALIDATION_ERROR",
      "collection.error.invoiceAlreadyPaid",
    );
  }
}

export function resolveCollectionStatusAfterAllocation(
  unallocatedAmount: Prisma.Decimal,
): CollectionStatus {
  if (unallocatedAmount.lessThanOrEqualTo(0)) {
    return CollectionStatus.Allocated;
  }
  return CollectionStatus.PartiallyAllocated;
}

export function resolveInvoiceStatusAfterAllocation(
  grandTotal: Prisma.Decimal,
  collectionReceived: Prisma.Decimal,
): InvoiceStatus {
  if (collectionReceived.greaterThanOrEqualTo(grandTotal)) {
    return InvoiceStatus.Paid;
  }
  if (collectionReceived.greaterThan(0)) {
    return InvoiceStatus.Partial;
  }
  return InvoiceStatus.Issued;
}
