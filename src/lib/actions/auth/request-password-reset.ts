"use server";

import { dispatchPasswordResetNotification } from "@/lib/notifications/auth-notifications";
import { requestPasswordResetSchema } from "@/lib/validators/auth.schema";
import { requestPasswordReset } from "@/lib/users/user-password-reset-service";
import {
  buildPasswordResetUrl,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from "@/lib/users/user-tokens";
import { prisma } from "@/lib/prisma";
import type {
  AuthActionResult,
  PasswordResetRequestDTO,
} from "@/types/authentication";

import { authOk, fromAuthZodError } from "./helpers";

/**
 * Password reset request — always returns success to prevent email enumeration.
 * Notification dispatched via PHASE_11B notification service when user exists.
 */
export async function requestPasswordResetAction(
  input: unknown,
): Promise<AuthActionResult<PasswordResetRequestDTO>> {
  const parsed = requestPasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    return fromAuthZodError(parsed.error);
  }

  const resetToken = await requestPasswordReset(parsed.data.email);

  if (resetToken) {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, name: true, email: true },
    });

    if (user) {
      try {
        await dispatchPasswordResetNotification({
          actorId: user.id,
          userId: user.id,
          name: user.name,
          email: user.email,
          resetLink: buildPasswordResetUrl(resetToken),
          expirationAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(
          `[Notification]\nPassword reset email skipped\nReason:\n${reason}\nUser:\n${user.email}`,
        );
      }
    }
  }

  return authOk({
    resetToken:
      process.env.NODE_ENV === "development" && resetToken
        ? buildPasswordResetUrl(resetToken)
        : null,
  });
}
