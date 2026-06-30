"use server";

import { revalidatePath } from "next/cache";

import { executeReverseCollectionTransaction } from "@/lib/collections/allocation-engine";
import { CollectionWorkflowError } from "@/lib/collections/workflow";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { reversalSchema } from "@/lib/validators/collection.schema";
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
 * Reverses a confirmed collection — restores dealer balance and invoice dues.
 */
export async function reverseCollection(
  input: unknown,
): Promise<ActionResult<CollectionDetailDTO>> {
  let user;
  try {
    user = await requirePermission("collections:edit");
  } catch {
    return fail<CollectionDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = reversalSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id, reversalReason } = parsed.data;

  try {
    await prisma.$transaction((tx) =>
      executeReverseCollectionTransaction(tx, {
        collectionId: id,
        userId: user.id,
        reversalReason,
      }),
    );

    const detail = await loadCollectionDetailDTO(id);
    if (!detail) {
      return fail<CollectionDetailDTO>(
        "COLLECTION_NOT_FOUND",
        "collection.error.notFound",
      );
    }

    revalidatePath("/dealers");
    revalidatePath("/invoices");

    return ok(detail);
  } catch (error) {
    if (error instanceof CollectionWorkflowError) {
      return mapCollectionWorkflowError(error);
    }
    return fromPrismaError(error);
  }
}
