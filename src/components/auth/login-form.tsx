"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, LogIn, AlertCircle } from "lucide-react";

import { loginAction } from "@/lib/actions/auth/login";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Form schema (client-side — mirrors server schema)
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "auth.error.emailRequired" })
    .email({ message: "auth.error.emailInvalid" }),
  password: z.string().min(1, { message: "auth.error.passwordRequired" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

function FormField({ label, error, required, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-500">
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login form
// ---------------------------------------------------------------------------

export function LoginForm() {
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: LoginFormValues) {
    setServerError(null);

    startTransition(async () => {
      const result = await loginAction(values);

      if (!result.success) {
        if (result.code === "validation_failed" && result.fieldErrors) {
          if (result.fieldErrors.email) {
            setError("email", { message: t(result.fieldErrors.email) });
          }
          if (result.fieldErrors.password) {
            setError("password", { message: t(result.fieldErrors.password) });
          }
          return;
        }

        if (result.code === "account_disabled") {
          setServerError(t("auth.error.accountDisabled"));
          return;
        }

        setServerError(t("auth.error.invalidCredentials"));
      }
    });
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5"
      aria-label={t("auth.login.formLabel")}
    >
      {/* Server-level error banner */}
      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-red-500"
          />
          <span>{serverError}</span>
        </div>
      )}

      {/* Email */}
      <FormField
        label={t("auth.login.emailLabel")}
        error={errors.email ? t(errors.email.message ?? "") : undefined}
        required
      >
        <input
          {...register("email")}
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!!errors.email}
          placeholder={t("auth.login.emailPlaceholder")}
          className={cn(
            "block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm",
            "placeholder:text-slate-400",
            "focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-600",
            errors.email
              ? "border-red-400 focus:ring-red-500/40 focus:border-red-500 dark:border-red-800"
              : "border-slate-300 dark:border-slate-700",
          )}
          disabled={isPending}
        />
      </FormField>

      {/* Password */}
      <FormField
        label={t("auth.login.passwordLabel")}
        error={errors.password ? t(errors.password.message ?? "") : undefined}
        required
      >
        <div className="relative">
          <input
            {...register("password")}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            placeholder={t("auth.login.passwordPlaceholder")}
            className={cn(
              "block w-full rounded-lg border bg-white py-2.5 pl-3.5 pr-10 text-sm text-slate-900 shadow-sm",
              "placeholder:text-slate-400",
              "focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-600",
              errors.password
                ? "border-red-400 focus:ring-red-500/40 focus:border-red-500 dark:border-red-800"
                : "border-slate-300 dark:border-slate-700",
            )}
            disabled={isPending}
          />
          <button
            type="button"
            aria-label={
              showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")
            }
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
      </FormField>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm",
          "bg-brand-600 text-white",
          "hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "transition-colors duration-150",
        )}
      >
        {isPending ? (
          <>
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {t("auth.login.signingIn")}
          </>
        ) : (
          <>
            <LogIn aria-hidden="true" className="size-4" />
            {t("auth.login.signIn")}
          </>
        )}
      </button>

      <a
        href="/auth/forgot-password"
        className="block text-center text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
      >
        {t("auth.login.forgotPassword")}
      </a>
    </form>
  );
}
