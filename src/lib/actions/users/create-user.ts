"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/helpers";
import { createUserRecord } from "@/lib/users";
import { createUserSchema } from "@/lib/validators/user-management.schema";
import type { ActionResult, CreateUserResultDTO } from "@/types/user-management";

import { fromDomainError, fromZodError, ok } from "./helpers";

export async function createUser(
  input: unknown,
): Promise<ActionResult<CreateUserResultDTO>> {
  try {
    const actor = await requireUser();
    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const data = await createUserRecord(actor, parsed.data);
    revalidatePath("/settings/users");
    return ok(data);
  } catch (error) {
    return fromDomainError(error);
  }
}
