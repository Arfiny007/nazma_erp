"use server";

import { revalidatePath } from "next/cache";

import {
  executeDeallocateCollectionTransaction,
  CollectionWorkflowError,
} from "@/lib/collections/allocation-engine";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { deallocateCollectionSchema } from "@/lib/validators/collection.schema";
import type { ActionResult, CollectionDetailDTO } from "@/types/collection";

import {
  fail,
  fromPrismaError,
  fromZodError,
  loadCollectionDetailDTO,
  mapCollectionWorkflowError,
  ok,
} from "./helpers";

/**
 * Removes one allocation row and restores invoice dues to the cash pool.
 */
export async function deallocateCollection(
  input: unknown,
): Promise<ActionResult<CollectionDetailDTO>> {
  let user;
  try {
    user = await requirePermission("collections:edit");
  } catch {
    return fail<CollectionDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = deallocateCollectionSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { collectionId, allocationId, reason } = parsed.data;

  try {
    await prisma.$transaction((tx) =>
      executeDeallocateCollectionTransaction(tx, {
        collectionId,
        allocationId,
        userId: user.id,
        reason: reason ?? null,
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
    if (error instanceof CollectionWorkflowError) {
      return mapCollectionWorkflowError(error);
    }
    return fromPrismaError(error);
  }
}
