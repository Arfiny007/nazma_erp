"use server";

import { activateAccountSchema, validateTokenSchema } from "@/lib/validators/auth.schema";
import {
  completeAccountActivation,
  validateActivationToken,
} from "@/lib/users/user-activation-service";
import type {
  ActivationValidationDTO,
  AuthActionResult,
} from "@/types/authentication";

import { authOk, fromAuthDomainError, fromAuthZodError } from "./helpers";

export async function validateActivationTokenAction(
  input: unknown,
): Promise<AuthActionResult<ActivationValidationDTO>> {
  try {
    const parsed = validateTokenSchema.safeParse(input);
    if (!parsed.success) {
      return fromAuthZodError(parsed.error);
    }

    const result = await validateActivationToken(parsed.data.token);
    return authOk({
      email: result.email,
      name: result.name,
    });
  } catch (error) {
    return fromAuthDomainError(error);
  }
}

export async function activateUserAccount(
  input: unknown,
): Promise<AuthActionResult<{ userId: string }>> {
  try {
    const parsed = activateAccountSchema.safeParse(input);
    if (!parsed.success) {
      return fromAuthZodError(parsed.error);
    }

    const result = await completeAccountActivation(
      parsed.data.token,
      parsed.data.password,
    );

    return authOk(result);
  } catch (error) {
    return fromAuthDomainError(error);
  }
}
