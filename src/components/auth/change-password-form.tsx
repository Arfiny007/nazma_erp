"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, KeyRound, Loader2, LogOut } from "lucide-react";

import { changePassword } from "@/lib/actions/auth/change-password";
import { changePasswordSchema } from "@/lib/validators/auth.schema";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

import { AuthErrorBanner, AuthFormField, authInputClassName } from "./auth-form-field";

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export function ChangePasswordForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  function onSubmit(values: ChangePasswordFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await changePassword(values);
      if (!result.success) {
        if (result.error.fieldErrors) {
          for (const fieldError of result.error.fieldErrors) {
            const field = fieldError.field as keyof ChangePasswordFormValues;
            if (field in values) {
              setError(field, { message: t(fieldError.messageKey) });
            }
          }
        }
        setServerError(t(result.error.messageKey));
        return;
      }
      router.push(result.data.redirectTo);
      router.refresh();
    });
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5"
      aria-label={t("auth.changePassword.formLabel")}
    >
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t("auth.changePassword.requiredNotice")}
      </p>

      {serverError && <AuthErrorBanner message={serverError} />}

      <AuthFormField
        label={t("auth.changePassword.currentPasswordLabel")}
        error={errors.currentPassword ? t(errors.currentPassword.message ?? "") : undefined}
        required
      >
        <div className="relative">
          <input
            {...register("currentPassword")}
            type={showCurrent ? "text" : "password"}
            autoComplete="current-password"
            className={cn(authInputClassName(!!errors.currentPassword), "pr-10")}
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400"
            tabIndex={-1}
          >
            {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </AuthFormField>

      <AuthFormField
        label={t("auth.changePassword.newPasswordLabel")}
        error={errors.newPassword ? t(errors.newPassword.message ?? "") : undefined}
        required
      >
        <div className="relative">
          <input
            {...register("newPassword")}
            type={showNew ? "text" : "password"}
            autoComplete="new-password"
            className={cn(authInputClassName(!!errors.newPassword), "pr-10")}
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400"
            tabIndex={-1}
          >
            {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </AuthFormField>

      <AuthFormField
        label={t("auth.changePassword.confirmPasswordLabel")}
        error={errors.confirmPassword ? t(errors.confirmPassword.message ?? "") : undefined}
        required
      >
        <div className="relative">
          <input
            {...register("confirmPassword")}
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            className={cn(authInputClassName(!!errors.confirmPassword), "pr-10")}
            disabled={isPending}
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
        disabled={isPending}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm",
          "bg-brand-600 text-white hover:bg-brand-700",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t("auth.changePassword.updating")}
          </>
        ) : (
          <>
            <KeyRound className="size-4" />
            {t("auth.changePassword.submit")}
          </>
        )}
      </button>

      <form action="/api/auth/signout" method="POST">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <LogOut className="size-4" />
          {t("auth.changePassword.signOut")}
        </button>
      </form>
    </form>
  );
}
