"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/helpers";
import { updateUserSchema } from "@/lib/validators/user-management.schema";
import { updateUserRecord } from "@/lib/users";
import type { ActionResult, UserDetailDTO } from "@/types/user-management";

import { fromDomainError, fromZodError, ok } from "./helpers";

export async function updateUser(
  input: unknown,
): Promise<ActionResult<UserDetailDTO>> {
  try {
    const actor = await requireUser();
    const parsed = updateUserSchema.safeParse(input);
    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const data = await updateUserRecord(actor, parsed.data);
    revalidatePath("/settings/users");
    return ok(data);
  } catch (error) {
    return fromDomainError(error);
  }
}
