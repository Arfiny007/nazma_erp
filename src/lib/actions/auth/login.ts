"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "../../../../auth";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "auth.error.emailRequired" })
    .email({ message: "auth.error.emailInvalid" }),
  password: z
    .string()
    .min(1, { message: "auth.error.passwordRequired" }),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type LoginResult =
  | { success: true }
  | {
      success: false;
      code: "invalid_credentials" | "account_disabled" | "validation_failed" | "unknown";
      fieldErrors?: Partial<Record<keyof LoginInput, string>>;
    };

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function loginAction(input: LoginInput): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof LoginInput, string>> = {};
    for (const [field, errors] of Object.entries(
      parsed.error.flatten().fieldErrors,
    )) {
      fieldErrors[field as keyof LoginInput] = errors?.[0];
    }
    return { success: false, code: "validation_failed", fieldErrors };
  }

  const { email, password } = parsed.data;

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = (error.cause?.err as { code?: string })?.code;

      if (code === "account_disabled") {
        return { success: false, code: "account_disabled" };
      }

      return { success: false, code: "invalid_credentials" };
    }
    // Re-throw unexpected errors (including NEXT_REDIRECT)
    throw error;
  }

  redirect("/");
}
