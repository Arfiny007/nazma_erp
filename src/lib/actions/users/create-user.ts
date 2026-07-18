"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/helpers";
import { dispatchActivationNotification } from "@/lib/notifications/auth-notifications";
import { createUserRecord } from "@/lib/users";
import { ACTIVATION_TOKEN_TTL_MS } from "@/lib/users/user-tokens";
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

    if (data.activationToken && data.activationUrl) {
      try {
        await dispatchActivationNotification({
          actorId: actor.id,
          userId: data.user.id,
          name: data.user.name,
          email: data.user.email,
          activationLink: data.activationUrl,
          expirationAt: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(
          `[Notification]\nActivation email skipped\nReason:\n${reason}\nUser:\n${data.user.email}`,
        );
      }
    }

    revalidatePath("/settings/users");
    return ok(data);
  } catch (error) {
    return fromDomainError(error);
  }
}
