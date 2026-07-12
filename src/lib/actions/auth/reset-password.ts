"use server";

import {
  completePasswordReset,
  validateResetToken,
} from "@/lib/users/user-password-reset-service";
import {
  resetPasswordSchema,
  validateTokenSchema,
} from "@/lib/validators/auth.schema";
import type {
  AuthActionResult,
  PasswordResetValidationDTO,
} from "@/types/authentication";

import { authOk, fromAuthDomainError, fromAuthZodError } from "./helpers";

export async function validateResetTokenAction(
  input: unknown,
): Promise<AuthActionResult<PasswordResetValidationDTO>> {
  try {
    const parsed = validateTokenSchema.safeParse(input);
    if (!parsed.success) {
      return fromAuthZodError(parsed.error);
    }

    const result = await validateResetToken(parsed.data.token);
    return authOk({ email: result.email });
  } catch (error) {
    return fromAuthDomainError(error);
  }
}

export async function resetPassword(
  input: unknown,
): Promise<AuthActionResult<{ userId: string }>> {
  try {
    const parsed = resetPasswordSchema.safeParse(input);
    if (!parsed.success) {
      return fromAuthZodError(parsed.error);
    }

    const result = await completePasswordReset(
      parsed.data.token,
      parsed.data.password,
    );

    return authOk(result);
  } catch (error) {
    return fromAuthDomainError(error);
  }
}
