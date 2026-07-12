"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail } from "lucide-react";

import { requestPasswordResetAction } from "@/lib/actions/auth/request-password-reset";
import { requestPasswordResetSchema } from "@/lib/validators/auth.schema";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

import { AuthErrorBanner, AuthFormField, AuthSuccessBanner, authInputClassName } from "./auth-form-field";

type ForgotPasswordFormValues = z.infer<typeof requestPasswordResetSchema>;

export function ForgotPasswordForm() {
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: ForgotPasswordFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction(values);
      if (!result.success) {
        if (result.error.fieldErrors) {
          for (const fieldError of result.error.fieldErrors) {
            if (fieldError.field === "email") {
              setError("email", { message: t(fieldError.messageKey) });
            }
          }
        }
        setServerError(t(result.error.messageKey));
        return;
      }
      setSubmitted(true);
      if (result.data.resetToken) {
        setDevResetUrl(result.data.resetToken);
      }
    });
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5"
      aria-label={t("auth.forgotPassword.formLabel")}
    >
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t("auth.forgotPassword.description")}
      </p>

      {submitted && <AuthSuccessBanner message={t("auth.forgotPassword.success")} />}
      {serverError && <AuthErrorBanner message={serverError} />}

      {devResetUrl && process.env.NODE_ENV === "development" && (
        <p className="break-all rounded-lg bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {t("auth.forgotPassword.devLink")}: {devResetUrl}
        </p>
      )}

      <AuthFormField
        label={t("auth.login.emailLabel")}
        error={errors.email ? t(errors.email.message ?? "") : undefined}
        required
      >
        <input
          {...register("email")}
          type="email"
          autoComplete="email"
          className={authInputClassName(!!errors.email)}
          disabled={isPending || submitted}
        />
      </AuthFormField>

      <button
        type="submit"
        disabled={isPending || submitted}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm",
          "bg-brand-600 text-white hover:bg-brand-700",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t("auth.forgotPassword.submitting")}
          </>
        ) : (
          <>
            <Mail className="size-4" />
            {t("auth.forgotPassword.submit")}
          </>
        )}
      </button>

      <Link
        href="/login"
        className="block text-center text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        {t("auth.forgotPassword.backToLogin")}
      </Link>
    </form>
  );
}
