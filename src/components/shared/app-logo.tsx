"use client";

import { CompanyLogoImage } from "@/components/shared/company-logo-image";
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
      <CompanyLogoImage size="sm" />
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
