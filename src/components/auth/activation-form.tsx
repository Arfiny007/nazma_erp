"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

import {
  activateUserAccount,
  validateActivationTokenAction,
} from "@/lib/actions/auth/activate-user-account";
import { activateAccountSchema } from "@/lib/validators/auth.schema";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

import { AuthErrorBanner, AuthFormField, authInputClassName } from "./auth-form-field";

type ActivationFormValues = z.infer<typeof activateAccountSchema>;

export function ActivationForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);
  const [accountName, setAccountName] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    setError,
  } = useForm<ActivationFormValues>({
    resolver: zodResolver(activateAccountSchema),
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
      void validateActivationTokenAction({ token }).then((result) => {
        setValidating(false);
        if (result.success) {
          setAccountName(result.data.name);
        } else {
          setServerError(t(result.error.messageKey));
        }
      });
    });
  }, [token, setValue, t]);

  function onSubmit(values: ActivationFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await activateUserAccount(values);
      if (!result.success) {
        if (result.error.fieldErrors) {
          for (const fieldError of result.error.fieldErrors) {
            const field = fieldError.field as keyof ActivationFormValues;
            if (field in values) {
              setError(field, { message: t(fieldError.messageKey) });
            }
          }
        }
        setServerError(t(result.error.messageKey));
        return;
      }
      router.push("/login?activated=1");
    });
  }

  if (validating || validateTransition) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-slate-500">
        <Loader2 className="mr-2 size-4 animate-spin" />
        {t("auth.activate.validating")}
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5"
      aria-label={t("auth.activate.formLabel")}
    >
      <input type="hidden" {...register("token")} />

      {accountName && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t("auth.activate.welcome")} {accountName}
        </p>
      )}

      {serverError && <AuthErrorBanner message={serverError} />}

      <AuthFormField
        label={t("auth.activate.passwordLabel")}
        error={errors.password ? t(errors.password.message ?? "") : undefined}
        required
      >
        <div className="relative">
          <input
            {...register("password")}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            className={cn(authInputClassName(!!errors.password), "pr-10")}
            disabled={isPending || !!serverError && !accountName}
          />
          <button
            type="button"
            aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </AuthFormField>

      <AuthFormField
        label={t("auth.activate.confirmPasswordLabel")}
        error={errors.confirmPassword ? t(errors.confirmPassword.message ?? "") : undefined}
        required
      >
        <div className="relative">
          <input
            {...register("confirmPassword")}
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            className={cn(authInputClassName(!!errors.confirmPassword), "pr-10")}
            disabled={isPending || !!serverError && !accountName}
          />
          <button
            type="button"
            aria-label={showConfirm ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </AuthFormField>

      <button
        type="submit"
        disabled={isPending || !accountName}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm",
          "bg-brand-600 text-white hover:bg-brand-700",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t("auth.activate.activating")}
          </>
        ) : (
          <>
            <KeyRound className="size-4" />
            {t("auth.activate.submit")}
          </>
        )}
      </button>
    </form>
  );
}
