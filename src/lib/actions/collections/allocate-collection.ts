"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  executeAllocateCollectionTransaction,
  toAllocationLineInputs,
  CollectionWorkflowError,
} from "@/lib/collections/allocation-engine";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { allocateCollectionSchema } from "@/lib/validators/collection.schema";
import type { ActionResult, CollectionDetailDTO } from "@/types/collection";

import {
  fail,
  fromPrismaError,
  fromZodError,
  loadCollectionDetailDTO,
  mapCollectionWorkflowError,
  mapReferenceError,
  ok,
} from "./helpers";

/**
 * Applies allocation lines from the collection cash pool to financial documents.
 */
export async function allocateCollection(
  input: unknown,
): Promise<ActionResult<CollectionDetailDTO>> {
  let user;
  try {
    user = await requirePermission("collections:edit");
  } catch {
    return fail<CollectionDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = allocateCollectionSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { collectionId, allocations } = parsed.data;

  try {
    await prisma.$transaction((tx) =>
      executeAllocateCollectionTransaction(tx, {
        collectionId,
        userId: user.id,
        allocations: toAllocationLineInputs(allocations),
      }),
    );

    const detail = await loadCollectionDetailDTO(collectionId);
    if (!detail) {
      return fail<CollectionDetailDTO>(
        "COLLECTION_NOT_FOUND",
        "collection.error.notFound",
      );
    }

    revalidatePath("/invoices");
    revalidatePath("/dealers");

    return ok(detail);
  } catch (error) {
    const referenceError = mapReferenceError<CollectionDetailDTO>(error);
    if (referenceError) {
      return referenceError;
    }
    if (error instanceof CollectionWorkflowError) {
      return mapCollectionWorkflowError(error);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return fromPrismaError(error);
    }
    return fromPrismaError(error);
  }
}
