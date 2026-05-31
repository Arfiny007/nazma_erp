"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  collapsed?: boolean;
  className?: string;
}

export function AppLogo({ collapsed = false, className }: AppLogoProps) {
  const { t } = useLanguage();
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 shadow-sm ring-1 ring-brand-500/20">
        <svg
          aria-hidden="true"
          className="size-5 text-white"
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
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {t("app.name")}
          </p>
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("app.tagline")}
          </p>
        </div>
      )}
    </div>
  );
}
