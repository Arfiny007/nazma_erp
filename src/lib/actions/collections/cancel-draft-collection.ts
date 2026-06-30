"use server";

import { CollectionStatus } from "@prisma/client";

import { assertCollectionCanBeCancelled } from "@/lib/collections/workflow";
import { CollectionWorkflowError } from "@/lib/collections/workflow";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guards";
import { collectionIdentifierSchema } from "@/lib/validators/collection.schema";
import type { ActionResult } from "@/types/collection";

import {
  CollectionActionError,
  fail,
  fromPrismaError,
  fromZodError,
  mapCollectionWorkflowError,
  ok,
} from "./helpers";

/**
 * Deletes a Draft collection. Confirmed collections cannot be cancelled —
 * use reversal instead.
 */
export async function cancelDraftCollection(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("collections:delete");
  } catch {
    return fail<{ id: string }>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = collectionIdentifierSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { id } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const collection = await tx.collection.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!collection) {
        throw new CollectionActionError(
          "COLLECTION_NOT_FOUND",
          "collection.error.notFound",
        );
      }

      assertCollectionCanBeCancelled(collection.status);

      if (collection.status !== CollectionStatus.Draft) {
        throw new CollectionWorkflowError(
          "INVALID_STATUS_TRANSITION",
          "collection.error.notDraft",
        );
      }

      await tx.collection.delete({ where: { id } });
    });

    return ok({ id });
  } catch (error) {
    if (error instanceof CollectionActionError) {
      return fail<{ id: string }>(error.code, error.messageKey);
    }
    if (error instanceof CollectionWorkflowError) {
      return mapCollectionWorkflowError(error);
    }
    return fromPrismaError(error);
  }
}
