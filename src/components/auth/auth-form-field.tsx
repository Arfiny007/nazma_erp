"use client";

import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

interface AuthFormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function AuthFormField({ label, error, required, children }: AuthFormFieldProps) {
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

export const authInputClassName = (hasError: boolean) =>
  cn(
    "block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm",
    "placeholder:text-slate-400",
    "focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-600",
    hasError
      ? "border-red-400 focus:ring-red-500/40 focus:border-red-500 dark:border-red-800"
      : "border-slate-300 dark:border-slate-700",
  );

export function AuthErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-red-500" />
      <span>{message}</span>
    </div>
  );
}

export function AuthSuccessBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
    >
      <span>{message}</span>
    </div>
  );
}
