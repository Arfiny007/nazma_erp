"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/helpers";
import { userIdentifierSchema } from "@/lib/validators/user-management.schema";
import { activateUserRecord } from "@/lib/users";
import type { ActionResult, UserDetailDTO } from "@/types/user-management";

import { fromDomainError, fromZodError, ok } from "./helpers";

export async function activateUser(
  input: unknown,
): Promise<ActionResult<UserDetailDTO>> {
  try {
    const actor = await requireUser();
    const parsed = userIdentifierSchema.safeParse(input);
    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const data = await activateUserRecord(actor, parsed.data.userId);
    revalidatePath("/settings/users");
    return ok(data);
  } catch (error) {
    return fromDomainError(error);
  }
}
