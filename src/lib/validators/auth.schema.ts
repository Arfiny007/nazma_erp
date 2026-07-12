import { z } from "zod";

export const permanentPasswordSchema = z
  .string()
  .min(8, { message: "auth.validation.passwordMin" })
  .max(128, { message: "auth.validation.passwordMax" })
  .regex(/[A-Z]/, { message: "auth.validation.passwordUppercase" })
  .regex(/[a-z]/, { message: "auth.validation.passwordLowercase" })
  .regex(/[0-9]/, { message: "auth.validation.passwordNumber" })
  .regex(/[^A-Za-z0-9]/, { message: "auth.validation.passwordSpecial" });

export const activateAccountSchema = z
  .object({
    token: z.string().min(1, { message: "auth.validation.tokenRequired" }),
    password: permanentPasswordSchema,
    confirmPassword: z.string().min(1, { message: "auth.validation.confirmPasswordRequired" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "auth.validation.passwordMismatch",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "auth.validation.currentPasswordRequired" }),
    newPassword: permanentPasswordSchema,
    confirmPassword: z.string().min(1, { message: "auth.validation.confirmPasswordRequired" }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "auth.validation.passwordMismatch",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "auth.validation.passwordSameAsCurrent",
    path: ["newPassword"],
  });

export const requestPasswordResetSchema = z.object({
  email: z
    .string()
    .min(1, { message: "auth.error.emailRequired" })
    .email({ message: "auth.error.emailInvalid" })
    .transform((value) => value.trim().toLowerCase()),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, { message: "auth.validation.tokenRequired" }),
    password: permanentPasswordSchema,
    confirmPassword: z.string().min(1, { message: "auth.validation.confirmPasswordRequired" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "auth.validation.passwordMismatch",
    path: ["confirmPassword"],
  });

export const validateTokenSchema = z.object({
  token: z.string().min(1, { message: "auth.validation.tokenRequired" }),
});

export type ActivateAccountInput = z.infer<typeof activateAccountSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
