"use server";

import { redirect } from "next/navigation";
import { signIn } from "../../../../auth";

import { requireUser } from "@/lib/auth/helpers";
import { changePasswordSchema } from "@/lib/validators/auth.schema";
import { changeUserPassword } from "@/lib/users/user-password-reset-service";
import type { AuthActionResult } from "@/types/authentication";

import { authOk, fromAuthDomainError, fromAuthZodError } from "./helpers";

export async function changePassword(
  input: unknown,
): Promise<AuthActionResult<{ redirectTo: string }>> {
  try {
    const actor = await requireUser();
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      return fromAuthZodError(parsed.error);
    }

    await changeUserPassword(
      actor,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );

    await signIn("credentials", {
      email: actor.email,
      password: parsed.data.newPassword,
      redirect: false,
    });

    return authOk({ redirectTo: "/" });
  } catch (error) {
    return fromAuthDomainError(error);
  }
}

export async function changePasswordAndRedirect(input: unknown): Promise<void> {
  const result = await changePassword(input);
  if (result.success) {
    redirect(result.data.redirectTo);
  }
}
