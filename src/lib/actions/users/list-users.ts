"use server";

import { requireUser } from "@/lib/auth/helpers";
import { listUsersSchema } from "@/lib/validators/user-management.schema";
import { listUsersRecord } from "@/lib/users";
import type { ActionResult, PaginatedResult, UserSummaryDTO } from "@/types/user-management";

import { fromDomainError, fromZodError, ok } from "./helpers";

export async function listUsers(
  input: unknown = {},
): Promise<ActionResult<PaginatedResult<UserSummaryDTO>>> {
  try {
    const actor = await requireUser();
    const parsed = listUsersSchema.safeParse(input);
    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const data = await listUsersRecord(actor, parsed.data);
    return ok(data);
  } catch (error) {
    return fromDomainError(error);
  }
}
