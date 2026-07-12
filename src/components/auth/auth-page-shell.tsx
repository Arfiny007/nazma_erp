import type { ReactNode } from "react";

interface AuthPageShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthPageShell({ title, subtitle, children }: AuthPageShellProps) {
  return (
    <div className="w-full max-w-sm">
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
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {children}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-600">
        Nazma Metal Industries &mdash; Internal ERP Platform
      </p>
    </div>
  );
}
