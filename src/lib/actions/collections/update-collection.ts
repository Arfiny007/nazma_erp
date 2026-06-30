"use server";

import { Prisma } from "@prisma/client";

import { assertCollectionCanBeUpdated, CollectionWorkflowError } from "@/lib/collections/workflow";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { updateCollectionSchema } from "@/lib/validators/collection.schema";
import type { ActionResult, CollectionDetailDTO } from "@/types/collection";

import {
  CollectionActionError,
  fail,
  fromPrismaError,
  fromZodError,
  loadCollectionDetailDTO,
  mapCollectionWorkflowError,
  ok,
} from "./helpers";

/**
 * Updates a Draft collection only.
 */
export async function updateCollection(
  input: unknown,
): Promise<ActionResult<CollectionDetailDTO>> {
  try {
    await requirePermission("collections:edit");
  } catch {
    return fail<CollectionDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = updateCollectionSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const data = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.collection.findUnique({
        where: { id: data.id },
        select: {
          id: true,
          status: true,
          allocatedAmount: true,
        },
      });

      if (!existing) {
        throw new CollectionActionError(
          "COLLECTION_NOT_FOUND",
          "collection.error.notFound",
        );
      }

      assertCollectionCanBeUpdated(existing.status);

      const receivedAmount = data.receivedAmount
        ? new Prisma.Decimal(data.receivedAmount)
        : undefined;

      if (
        receivedAmount &&
        receivedAmount.lessThan(existing.allocatedAmount)
      ) {
        throw new CollectionActionError(
          "VALIDATION_ERROR",
          "collection.error.receivedBelowAllocated",
        );
      }

      const unallocatedAmount = receivedAmount
        ? receivedAmount.minus(existing.allocatedAmount)
        : undefined;

      await tx.collection.update({
        where: { id: data.id },
        data: {
          collectionDate: data.collectionDate,
          paymentMethod: data.paymentMethod,
          receivedAmount,
          unallocatedAmount,
          referenceNumber: data.referenceNumber,
          bankName: data.bankName,
          remarks: data.remarks,
          isAdvancePayment: data.isAdvancePayment,
        },
      });
    });

    const detail = await loadCollectionDetailDTO(data.id);
    if (!detail) {
      return fail<CollectionDetailDTO>(
        "COLLECTION_NOT_FOUND",
        "collection.error.notFound",
      );
    }

    return ok(detail);
  } catch (error) {
    if (error instanceof CollectionActionError) {
      return fail<CollectionDetailDTO>(error.code, error.messageKey);
    }
    if (error instanceof CollectionWorkflowError) {
      return mapCollectionWorkflowError(error);
    }
    return fromPrismaError(error);
  }
}
