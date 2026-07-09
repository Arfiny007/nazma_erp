import {
  CollectionStatus,
  FinancialReferenceType,
  Prisma,
} from "@prisma/client";

import {
  applyInvoiceAllocation,
  ReferenceNotFoundError,
  resolveFinancialReference,
  reverseInvoiceAllocation,
  UnsupportedReferenceTypeError,
} from "@/lib/collections/reference-resolver";
import {
  assertCollectionCanBeAllocated,
  assertCollectionCanBeConfirmed,
  assertCollectionCanBeReversed,
  assertInvoiceAllocatable,
  assertPositiveAllocationAmount,
  CollectionWorkflowError,
  resolveCollectionStatusAfterAllocation,
} from "@/lib/collections/workflow";
import { lockDealerForFinancialUpdate } from "@/lib/finance/dealer-lock";
import {
  postReceivableDecrease,
  postReceivableDecreaseReversal,
} from "@/lib/finance/posting-service";
import {
  COLLECTION_ALLOCATED_ACTION,
  COLLECTION_CONFIRMED_ACTION,
  COLLECTION_DEALLOCATED_ACTION,
  COLLECTION_REVERSED_ACTION,
  COLLECTION_REVERSED_MISALLOCATION_ACTION,
  FINANCIAL_REFERENCE_COLLECTION,
  FINANCIAL_REFERENCE_INVOICE,
} from "@/lib/finance/types";
import type { AllocationPreviewLine } from "@/types/collection";

import { COLLECTION_ENTITY_TYPE, ZERO_MONEY } from "@/lib/actions/collections/helpers";

export interface AllocationLineInput {
  referenceType: FinancialReferenceType;
  referenceId: string;
  allocatedAmount: Prisma.Decimal;
  allocationOrder: number;
  remarks?: string | null;
}

export interface AllocationPreviewResult {
  lines: Array<{
    referenceType: FinancialReferenceType;
    referenceId: string;
    referenceLabel: string | null;
    requestedAmount: string;
    applicableAmount: string;
    outstanding: string;
    allocationOrder: number;
    remarks: string | null;
    warnings: string[];
  }>;
  totalRequested: string;
  totalApplicable: string;
  unallocatedBefore: string;
  unallocatedAfter: string;
}

export interface ConfirmCollectionInput {
  collectionId: string;
  userId: string;
}

export interface AllocateCollectionInput {
  collectionId: string;
  userId: string;
  allocations: AllocationLineInput[];
}

export interface DeallocateCollectionInput {
  collectionId: string;
  userId: string;
  allocationId: string;
  reason?: string | null;
}

export interface ReverseCollectionInput {
  collectionId: string;
  userId: string;
  reversalReason: string;
}

function assertAmountInvariant(
  received: Prisma.Decimal,
  allocated: Prisma.Decimal,
  unallocated: Prisma.Decimal,
): void {
  if (!received.equals(allocated.plus(unallocated))) {
    throw new Error(
      `Collection amount invariant violated: received=${received.toFixed(2)} allocated=${allocated.toFixed(2)} unallocated=${unallocated.toFixed(2)}`,
    );
  }
}

export function computeApplicableAllocationAmount(
  requested: Prisma.Decimal,
  unallocatedPool: Prisma.Decimal,
  documentOutstanding: Prisma.Decimal,
): Prisma.Decimal {
  return Prisma.Decimal.min(
    requested,
    Prisma.Decimal.min(unallocatedPool, documentOutstanding),
  );
}

export async function previewAllocationLines(
  tx: Prisma.TransactionClient,
  collection: {
    dealerCode: string;
    unallocatedAmount: Prisma.Decimal;
  },
  lines: AllocationLineInput[],
): Promise<AllocationPreviewResult> {
  let poolRemaining = collection.unallocatedAmount;
  let totalRequested = ZERO_MONEY;
  let totalApplicable = ZERO_MONEY;

  const previewLines: AllocationPreviewResult["lines"] = [];

  for (const line of lines) {
    totalRequested = totalRequested.plus(line.allocatedAmount);
    const warnings: string[] = [];

    let referenceLabel: string | null = null;
    let outstanding = ZERO_MONEY;
    let applicable = ZERO_MONEY;

    try {
      const resolved = await resolveFinancialReference(
        tx,
        line.referenceType,
        line.referenceId,
        collection.dealerCode,
      );
      referenceLabel = resolved.referenceLabel;
      outstanding = resolved.outstanding;
      assertInvoiceAllocatable(resolved.status);

      applicable = computeApplicableAllocationAmount(
        line.allocatedAmount,
        poolRemaining,
        outstanding,
      );

      if (applicable.lessThan(line.allocatedAmount)) {
        warnings.push("collection.preview.amountCapped");
      }
      if (applicable.lessThanOrEqualTo(0)) {
        warnings.push("collection.preview.zeroApplicable");
      }
    } catch (error) {
      if (error instanceof ReferenceNotFoundError) {
        warnings.push("collection.preview.referenceNotFound");
      } else if (error instanceof UnsupportedReferenceTypeError) {
        warnings.push("collection.preview.unsupportedReference");
      } else if (error instanceof CollectionWorkflowError) {
        warnings.push(error.messageKey);
      } else {
        throw error;
      }
    }

    totalApplicable = totalApplicable.plus(applicable);
    poolRemaining = poolRemaining.minus(applicable);

    previewLines.push({
      referenceType: line.referenceType,
      referenceId: line.referenceId,
      referenceLabel,
      requestedAmount: line.allocatedAmount.toFixed(2),
      applicableAmount: applicable.toFixed(2),
      outstanding: outstanding.toFixed(2),
      allocationOrder: line.allocationOrder,
      remarks: line.remarks ?? null,
      warnings,
    });
  }

  return {
    lines: previewLines,
    totalRequested: totalRequested.toFixed(2),
    totalApplicable: totalApplicable.toFixed(2),
    unallocatedBefore: collection.unallocatedAmount.toFixed(2),
    unallocatedAfter: poolRemaining.toFixed(2),
  };
}

export async function executeConfirmCollectionTransaction(
  tx: Prisma.TransactionClient,
  input: ConfirmCollectionInput,
): Promise<string> {
  const collection = await tx.collection.findUnique({
    where: { id: input.collectionId },
    select: {
      id: true,
      collectionNo: true,
      dealerCode: true,
      status: true,
      receivedAmount: true,
      allocatedAmount: true,
      unallocatedAmount: true,
      confirmedAt: true,
    },
  });

  if (!collection) {
    throw new CollectionWorkflowError(
      "COLLECTION_NOT_FOUND",
      "collection.error.notFound",
    );
  }

  if (collection.status === CollectionStatus.Confirmed) {
    return collection.id;
  }

  assertCollectionCanBeConfirmed(collection.status);

  if (collection.receivedAmount.lessThanOrEqualTo(0)) {
    throw new CollectionWorkflowError(
      "VALIDATION_ERROR",
      "collection.error.invalidAmount",
    );
  }

  const lockedDealer = await lockDealerForFinancialUpdate(tx, collection.dealerCode);

  const existingConfirmed = await tx.collection.findUnique({
    where: { id: input.collectionId },
    select: { status: true, confirmedAt: true },
  });
  if (
    existingConfirmed?.status === CollectionStatus.Confirmed &&
    existingConfirmed.confirmedAt
  ) {
    return input.collectionId;
  }

  await postReceivableDecrease({
    tx,
    dealerCode: collection.dealerCode,
    amount: collection.receivedAmount,
    previousBalance: lockedDealer.currentBalance,
    userId: input.userId,
    referenceType: FINANCIAL_REFERENCE_COLLECTION,
    referenceId: collection.id,
    referenceNo: collection.collectionNo,
    collectionId: collection.id,
    collectionNo: collection.collectionNo,
    applyDealerBalance: true,
    metadata: {
      event: COLLECTION_CONFIRMED_ACTION,
      cashReceipt: "true",
    },
  });

  const confirmedAt = new Date();
  const isAdvance =
    collection.unallocatedAmount.greaterThan(0) ||
    collection.receivedAmount.greaterThan(collection.allocatedAmount);

  await tx.collection.update({
    where: { id: collection.id },
    data: {
      status: CollectionStatus.Confirmed,
      confirmedAt,
      confirmedById: input.userId,
      isAdvancePayment: isAdvance,
      unallocatedAmount: collection.receivedAmount.minus(collection.allocatedAmount),
      allocatedAmount: collection.allocatedAmount,
    },
  });

  await tx.dealer.update({
    where: { dealerCode: collection.dealerCode },
    data: { lastCollectionDate: confirmedAt },
  });

  await recordCollectionAudit(tx, {
    userId: input.userId,
    collectionId: collection.id,
    action: COLLECTION_CONFIRMED_ACTION,
    payload: {
      collectionNo: collection.collectionNo,
      dealerCode: collection.dealerCode,
      receivedAmount: collection.receivedAmount.toFixed(2),
      allocatedAmount: collection.allocatedAmount.toFixed(2),
      unallocatedAmount: collection.unallocatedAmount.toFixed(2),
      actor: input.userId,
      timestamp: confirmedAt.toISOString(),
    },
  });

  return collection.id;
}

export async function executeAllocateCollectionTransaction(
  tx: Prisma.TransactionClient,
  input: AllocateCollectionInput,
): Promise<string> {
  const collection = await tx.collection.findUnique({
    where: { id: input.collectionId },
    include: {
      allocations: {
        select: {
          id: true,
          referenceType: true,
          referenceId: true,
        },
      },
    },
  });

  if (!collection) {
    throw new CollectionWorkflowError(
      "COLLECTION_NOT_FOUND",
      "collection.error.notFound",
    );
  }

  assertCollectionCanBeAllocated(collection.status);
  await lockDealerForFinancialUpdate(tx, collection.dealerCode);

  const existingKeys = new Set(
    collection.allocations.map(
      (row) => `${row.referenceType}:${row.referenceId}`,
    ),
  );

  let poolRemaining = collection.unallocatedAmount;
  let allocatedTotal = collection.allocatedAmount;

  for (const line of input.allocations) {
    assertPositiveAllocationAmount(line.allocatedAmount);

    const dedupeKey = `${line.referenceType}:${line.referenceId}`;
    if (existingKeys.has(dedupeKey)) {
      throw new CollectionWorkflowError(
        "VALIDATION_ERROR",
        "collection.error.duplicateAllocation",
      );
    }

    if (line.allocatedAmount.greaterThan(poolRemaining)) {
      throw new CollectionWorkflowError(
        "ALLOCATION_EXCEEDS_RECEIVED",
        "collection.error.allocationExceedsUnallocated",
      );
    }

    const resolved = await resolveFinancialReference(
      tx,
      line.referenceType,
      line.referenceId,
      collection.dealerCode,
    );

    assertInvoiceAllocatable(resolved.status);

    if (line.allocatedAmount.greaterThan(resolved.outstanding)) {
      throw new CollectionWorkflowError(
        "ALLOCATION_EXCEEDS_RECEIVED",
        "collection.error.allocationExceedsOutstanding",
      );
    }

    const applicable = computeApplicableAllocationAmount(
      line.allocatedAmount,
      poolRemaining,
      resolved.outstanding,
    );

    if (applicable.lessThanOrEqualTo(0)) {
      throw new CollectionWorkflowError(
        "VALIDATION_ERROR",
        "collection.error.allocationMustBePositive",
      );
    }

    if (line.referenceType === FINANCIAL_REFERENCE_INVOICE) {
      await applyInvoiceAllocation(tx, line.referenceId, applicable);
    }

    await tx.collectionAllocation.create({
      data: {
        collectionId: collection.id,
        referenceType: line.referenceType,
        referenceId: line.referenceId,
        allocatedAmount: applicable,
        allocationOrder: line.allocationOrder,
        remarks: line.remarks ?? null,
      },
    });

    existingKeys.add(dedupeKey);
    poolRemaining = poolRemaining.minus(applicable);
    allocatedTotal = allocatedTotal.plus(applicable);

    await recordCollectionAudit(tx, {
      userId: input.userId,
      collectionId: collection.id,
      action: COLLECTION_ALLOCATED_ACTION,
      payload: {
        collectionNo: collection.collectionNo,
        dealerCode: collection.dealerCode,
        allocatedAmount: applicable.toFixed(2),
        unallocatedAmount: poolRemaining.toFixed(2),
        referenceType: line.referenceType,
        referenceId: line.referenceId,
        referenceNo: resolved.referenceLabel,
        actor: input.userId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  const receivedAmount = collection.receivedAmount;
  assertAmountInvariant(receivedAmount, allocatedTotal, poolRemaining);

  const newStatus = resolveCollectionStatusAfterAllocation(poolRemaining);

  await tx.collection.update({
    where: { id: collection.id },
    data: {
      allocatedAmount: allocatedTotal,
      unallocatedAmount: poolRemaining,
      status: newStatus,
      isAdvancePayment: poolRemaining.greaterThan(0),
    },
  });

  return collection.id;
}

export async function executeDeallocateCollectionTransaction(
  tx: Prisma.TransactionClient,
  input: DeallocateCollectionInput,
): Promise<string> {
  const allocation = await tx.collectionAllocation.findUnique({
    where: { id: input.allocationId },
    include: {
      collection: {
        select: {
          id: true,
          collectionNo: true,
          dealerCode: true,
          status: true,
          receivedAmount: true,
          allocatedAmount: true,
          unallocatedAmount: true,
        },
      },
    },
  });

  if (!allocation || allocation.collectionId !== input.collectionId) {
    throw new CollectionWorkflowError(
      "VALIDATION_ERROR",
      "collection.error.allocationNotFound",
    );
  }

  const collection = allocation.collection;
  assertCollectionCanBeAllocated(collection.status);
  await lockDealerForFinancialUpdate(tx, collection.dealerCode);

  if (allocation.referenceType === FINANCIAL_REFERENCE_INVOICE) {
    await reverseInvoiceAllocation(
      tx,
      allocation.referenceId,
      allocation.allocatedAmount,
    );
  }

  await tx.collectionAllocation.delete({
    where: { id: allocation.id },
  });

  const newAllocated = collection.allocatedAmount.minus(
    allocation.allocatedAmount,
  );
  const newUnallocated = collection.unallocatedAmount.plus(
    allocation.allocatedAmount,
  );

  assertAmountInvariant(
    collection.receivedAmount,
    newAllocated,
    newUnallocated,
  );

  const newStatus = resolveCollectionStatusAfterAllocation(newUnallocated);

  await tx.collection.update({
    where: { id: collection.id },
    data: {
      allocatedAmount: newAllocated,
      unallocatedAmount: newUnallocated,
      status: newStatus,
      isAdvancePayment: newUnallocated.greaterThan(0),
    },
  });

  await recordCollectionAudit(tx, {
    userId: input.userId,
    collectionId: collection.id,
    action: COLLECTION_DEALLOCATED_ACTION,
    payload: {
      collectionNo: collection.collectionNo,
      dealerCode: collection.dealerCode,
      allocatedAmount: allocation.allocatedAmount.toFixed(2),
      unallocatedAmount: newUnallocated.toFixed(2),
      referenceType: allocation.referenceType,
      referenceId: allocation.referenceId,
      actor: input.userId,
      reason: input.reason ?? null,
      timestamp: new Date().toISOString(),
    },
  });

  return collection.id;
}

export async function executeReverseCollectionTransaction(
  tx: Prisma.TransactionClient,
  input: ReverseCollectionInput,
): Promise<string> {
  const collection = await tx.collection.findUnique({
    where: { id: input.collectionId },
    include: {
      allocations: true,
    },
  });

  if (!collection) {
    throw new CollectionWorkflowError(
      "COLLECTION_NOT_FOUND",
      "collection.error.notFound",
    );
  }

  assertCollectionCanBeReversed(collection.status);

  const lockedDealer = await lockDealerForFinancialUpdate(
    tx,
    collection.dealerCode,
  );

  for (const allocation of collection.allocations) {
    if (allocation.referenceType === FINANCIAL_REFERENCE_INVOICE) {
      await reverseInvoiceAllocation(
        tx,
        allocation.referenceId,
        allocation.allocatedAmount,
      );
    }

    await recordCollectionAudit(tx, {
      userId: input.userId,
      collectionId: collection.id,
      action: COLLECTION_REVERSED_MISALLOCATION_ACTION,
      payload: {
        collectionNo: collection.collectionNo,
        dealerCode: collection.dealerCode,
        allocatedAmount: allocation.allocatedAmount.toFixed(2),
        referenceType: allocation.referenceType,
        referenceId: allocation.referenceId,
        actor: input.userId,
        reason: input.reversalReason,
        previousCollectionId: collection.id,
        timestamp: new Date().toISOString(),
      },
    });
  }

  await postReceivableDecreaseReversal({
    tx,
    dealerCode: collection.dealerCode,
    amount: collection.receivedAmount,
    previousBalance: lockedDealer.currentBalance,
    userId: input.userId,
    referenceType: FINANCIAL_REFERENCE_COLLECTION,
    referenceId: collection.id,
    referenceNo: collection.collectionNo,
    collectionId: collection.id,
    collectionNo: collection.collectionNo,
    metadata: {
      reason: input.reversalReason,
      reversal: "true",
    },
  });

  const reversedAt = new Date();

  await tx.collection.update({
    where: { id: collection.id },
    data: {
      status: CollectionStatus.Reversed,
      reversedAt,
      reversalReason: input.reversalReason,
      allocatedAmount: ZERO_MONEY,
      unallocatedAmount: ZERO_MONEY,
    },
  });

  await tx.collectionAllocation.deleteMany({
    where: { collectionId: collection.id },
  });

  await recordCollectionAudit(tx, {
    userId: input.userId,
    collectionId: collection.id,
    action: COLLECTION_REVERSED_ACTION,
    payload: {
      collectionNo: collection.collectionNo,
      dealerCode: collection.dealerCode,
      receivedAmount: collection.receivedAmount.toFixed(2),
      allocatedAmount: collection.allocatedAmount.toFixed(2),
      unallocatedAmount: collection.unallocatedAmount.toFixed(2),
      actor: input.userId,
      reason: input.reversalReason,
      previousCollectionId: collection.id,
      timestamp: reversedAt.toISOString(),
    },
  });

  return collection.id;
}

export function toAllocationLineInputs(
  lines: AllocationPreviewLine[],
): AllocationLineInput[] {
  return lines.map((line) => ({
    referenceType: line.referenceType,
    referenceId: line.referenceId,
    allocatedAmount: new Prisma.Decimal(line.allocatedAmount),
    allocationOrder: line.allocationOrder,
    remarks: line.remarks ?? null,
  }));
}

async function recordCollectionAudit(
  tx: Pick<Prisma.TransactionClient, "auditLog">,
  params: {
    userId: string;
    collectionId: string;
    action: string;
    payload: Prisma.JsonObject;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: params.userId,
      entityType: COLLECTION_ENTITY_TYPE,
      entityId: params.collectionId,
      action: params.action,
      oldValue: Prisma.JsonNull,
      newValue: params.payload,
    },
  });
}

export {
  CollectionWorkflowError,
  ReferenceNotFoundError,
  UnsupportedReferenceTypeError,
};
