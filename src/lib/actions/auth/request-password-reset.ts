"use server";

import { requestPasswordResetSchema } from "@/lib/validators/auth.schema";
import { requestPasswordReset } from "@/lib/users/user-password-reset-service";
import { buildPasswordResetUrl } from "@/lib/users/user-tokens";
import type {
  AuthActionResult,
  PasswordResetRequestDTO,
} from "@/types/authentication";

import { authOk, fromAuthZodError } from "./helpers";

/**
 * Password reset request — infrastructure only (no email delivery).
 * Always returns success to prevent email enumeration.
 */
export async function requestPasswordResetAction(
  input: unknown,
): Promise<AuthActionResult<PasswordResetRequestDTO>> {
  const parsed = requestPasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    return fromAuthZodError(parsed.error);
  }

  const resetToken = await requestPasswordReset(parsed.data.email);

  return authOk({
    resetToken: resetToken ? buildPasswordResetUrl(resetToken) : null,
  });
}
