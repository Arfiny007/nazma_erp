"use server";

import { requirePermission } from "@/lib/rbac/guards";
import { canAccessCollection } from "@/lib/rbac/territory";
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
  let user;
  try {
    user = await requirePermission("collections:view");
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

  const allowed = await canAccessCollection(user.id, detail.id);
  if (!allowed) {
    return fail<CollectionDetailDTO>("FORBIDDEN", "rbac.territory.noAccess");
  }

  return ok(detail);
}
