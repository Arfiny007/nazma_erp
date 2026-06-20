import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign In | Nazma ERP",
  description: "Sign in to Nazma ERP to manage dealers, orders, and financials.",
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      {/* Brand header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-600 shadow-md ring-1 ring-brand-500/20">
          <svg
            aria-hidden="true"
            className="size-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 3L4 9v12h16V9L12 3z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
            />
            <path
              d="M9 21v-6h6v6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Nazma ERP
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sign in to continue to your dashboard
        </p>
      </div>

      {/* Login card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <LoginForm />
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-600">
        Nazma Metal Industries &mdash; Internal ERP Platform
      </p>
    </div>
  );
}
