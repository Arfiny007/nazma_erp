"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

import {
  resetPassword,
  validateResetTokenAction,
} from "@/lib/actions/auth/reset-password";
import { resetPasswordSchema } from "@/lib/validators/auth.schema";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

import { AuthErrorBanner, AuthFormField, authInputClassName } from "./auth-form-field";

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    setError,
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  const [validateTransition, startValidate] = useTransition();

  useEffect(() => {
    setValue("token", token);
    if (!token) {
      startValidate(() => {
        setValidating(false);
        setServerError(t("auth.error.tokenInvalid"));
      });
      return;
    }

    startValidate(() => {
      void validateResetTokenAction({ token }).then((result) => {
        setValidating(false);
        if (result.success) {
          setAccountEmail(result.data.email);
        } else {
          setServerError(t(result.error.messageKey));
        }
      });
    });
  }, [token, setValue, t]);

  function onSubmit(values: ResetPasswordFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await resetPassword(values);
      if (!result.success) {
        if (result.error.fieldErrors) {
          for (const fieldError of result.error.fieldErrors) {
            const field = fieldError.field as keyof ResetPasswordFormValues;
            if (field in values) {
              setError(field, { message: t(fieldError.messageKey) });
            }
          }
        }
        setServerError(t(result.error.messageKey));
        return;
      }
      router.push("/login?reset=1");
    });
  }

  if (validating || validateTransition) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-slate-500">
        <Loader2 className="mr-2 size-4 animate-spin" />
        {t("auth.resetPassword.validating")}
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5"
      aria-label={t("auth.resetPassword.formLabel")}
    >
      <input type="hidden" {...register("token")} />

      {accountEmail && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t("auth.resetPassword.account")} {accountEmail}
        </p>
      )}

      {serverError && <AuthErrorBanner message={serverError} />}

      <AuthFormField
        label={t("auth.resetPassword.passwordLabel")}
        error={errors.password ? t(errors.password.message ?? "") : undefined}
        required
      >
        <div className="relative">
          <input
            {...register("password")}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            className={cn(authInputClassName(!!errors.password), "pr-10")}
            disabled={isPending || !!serverError && !accountEmail}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </AuthFormField>

      <AuthFormField
        label={t("auth.resetPassword.confirmPasswordLabel")}
        error={errors.confirmPassword ? t(errors.confirmPassword.message ?? "") : undefined}
        required
      >
        <div className="relative">
          <input
            {...register("confirmPassword")}
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            className={cn(authInputClassName(!!errors.confirmPassword), "pr-10")}
            disabled={isPending || !!serverError && !accountEmail}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400"
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </AuthFormField>

      <button
        type="submit"
        disabled={isPending || !accountEmail}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm",
          "bg-brand-600 text-white hover:bg-brand-700",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t("auth.resetPassword.resetting")}
          </>
        ) : (
          <>
            <KeyRound className="size-4" />
            {t("auth.resetPassword.submit")}
          </>
        )}
      </button>
    </form>
  );
}
