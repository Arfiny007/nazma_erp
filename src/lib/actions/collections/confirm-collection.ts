"use server";

import { revalidatePath } from "next/cache";

import { executeConfirmCollectionTransaction } from "@/lib/collections/allocation-engine";
import { CollectionWorkflowError } from "@/lib/collections/workflow";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { collectionIdentifierSchema } from "@/lib/validators/collection.schema";
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
 * Confirms a Draft collection — cash receipt is posted and the record becomes
 * immutable. Idempotent when already confirmed.
 */
export async function confirmCollection(
  input: unknown,
): Promise<ActionResult<CollectionDetailDTO>> {
  let user;
  try {
    user = await requirePermission("collections:edit");
  } catch {
    return fail<CollectionDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = collectionIdentifierSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id } = parsed.data;

  try {
    await prisma.$transaction((tx) =>
      executeConfirmCollectionTransaction(tx, {
        collectionId: id,
        userId: user.id,
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

    return ok(detail);
  } catch (error) {
    if (error instanceof CollectionWorkflowError) {
      return mapCollectionWorkflowError(error);
    }
    return fromPrismaError(error);
  }
}
