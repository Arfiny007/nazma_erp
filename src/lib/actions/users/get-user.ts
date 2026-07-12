"use server";

import { requireUser } from "@/lib/auth/helpers";
import { userIdentifierSchema } from "@/lib/validators/user-management.schema";
import { getUserRecord } from "@/lib/users";
import type { ActionResult, UserDetailDTO } from "@/types/user-management";

import { fromDomainError, fromZodError, ok } from "./helpers";

export async function getUser(
  input: unknown,
): Promise<ActionResult<UserDetailDTO>> {
  try {
    const actor = await requireUser();
    const parsed = userIdentifierSchema.safeParse(input);
    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const data = await getUserRecord(actor, parsed.data.userId);
    return ok(data);
  } catch (error) {
    return fromDomainError(error);
  }
}
