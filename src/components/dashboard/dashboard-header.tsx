"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import type { DashboardRole } from "@/types/dashboard";

interface DashboardHeaderProps {
  role: DashboardRole;
  generatedAt: string;
}

export function DashboardHeader({ role, generatedAt }: DashboardHeaderProps) {
  const { t } = useLanguage();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t("dashboard.header.roleLabel")}
        </p>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t(`dashboard.roles.${role}`)}
        </p>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t("dashboard.header.generatedAt")}{" "}
        <time dateTime={generatedAt}>
          {new Date(generatedAt).toLocaleString()}
        </time>
      </p>
    </header>
  );
}
