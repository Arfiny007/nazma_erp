"use server";

import { requireUser } from "@/lib/auth/helpers";
import { searchUsersSchema } from "@/lib/validators/user-management.schema";
import { searchUsersRecord } from "@/lib/users";
import type { ActionResult, UserSummaryDTO } from "@/types/user-management";

import { fromDomainError, fromZodError, ok } from "./helpers";

export async function searchUsers(
  input: unknown,
): Promise<ActionResult<UserSummaryDTO[]>> {
  try {
    const actor = await requireUser();
    const parsed = searchUsersSchema.safeParse(input);
    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const data = await searchUsersRecord(actor, parsed.data);
    return ok(data);
  } catch (error) {
    return fromDomainError(error);
  }
}
