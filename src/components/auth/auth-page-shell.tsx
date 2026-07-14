import type { ReactNode } from "react";

import { CompanyLogoImage } from "@/components/shared/company-logo-image";

interface AuthPageShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthPageShell({ title, subtitle, children }: AuthPageShellProps) {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <CompanyLogoImage size="md" />
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
