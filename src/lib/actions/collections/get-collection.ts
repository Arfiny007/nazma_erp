"use server";

import { requirePermission } from "@/lib/rbac/guards";
import { collectionIdentifierSchema } from "@/lib/validators/collection.schema";
import type { ActionResult, CollectionDetailDTO } from "@/types/collection";

import {
  fail,
  fromZodError,
  loadCollectionDetailDTO,
  ok,
} from "./helpers";

export async function getCollection(
  input: unknown,
): Promise<ActionResult<CollectionDetailDTO>> {
  try {
    await requirePermission("collections:view");
  } catch {
    return fail<CollectionDetailDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = collectionIdentifierSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const detail = await loadCollectionDetailDTO(parsed.data.id);
  if (!detail) {
    return fail<CollectionDetailDTO>(
      "COLLECTION_NOT_FOUND",
      "collection.error.notFound",
    );
  }

  return ok(detail);
}
