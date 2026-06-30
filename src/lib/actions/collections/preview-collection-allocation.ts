"use server";

import {
  previewAllocationLines,
  toAllocationLineInputs,
  CollectionWorkflowError,
} from "@/lib/collections/allocation-engine";
import { assertCollectionCanBeAllocated } from "@/lib/collections/workflow";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { allocationPreviewSchema } from "@/lib/validators/collection.schema";
import type { ActionResult } from "@/types/collection";

import type { AllocationPreviewResult } from "@/lib/collections/allocation-engine";
import {
  fail,
  fromZodError,
  mapCollectionWorkflowError,
  mapReferenceError,
  ok,
} from "./helpers";

export async function previewCollectionAllocation(
  input: unknown,
): Promise<ActionResult<AllocationPreviewResult>> {
  try {
    await requirePermission("collections:view");
  } catch {
    return fail<AllocationPreviewResult>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = allocationPreviewSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { collectionId, allocations } = parsed.data;

  try {
    const preview = await prisma.$transaction(async (tx) => {
      const collection = await tx.collection.findUnique({
        where: { id: collectionId },
        select: {
          dealerCode: true,
          status: true,
          unallocatedAmount: true,
        },
      });

      if (!collection) {
        throw new CollectionWorkflowError(
          "COLLECTION_NOT_FOUND",
          "collection.error.notFound",
        );
      }

      assertCollectionCanBeAllocated(collection.status);

      return previewAllocationLines(
        tx,
        collection,
        toAllocationLineInputs(allocations),
      );
    });

    return ok(preview);
  } catch (error) {
    const referenceError = mapReferenceError<AllocationPreviewResult>(error);
    if (referenceError) {
      return referenceError;
    }
    if (error instanceof CollectionWorkflowError) {
      return mapCollectionWorkflowError(error);
    }
    throw error;
  }
}
