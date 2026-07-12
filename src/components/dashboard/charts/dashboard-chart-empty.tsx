"use client";

import { useLanguage } from "@/contexts/LanguageContext";

interface DashboardChartEmptyProps {
  titleKey?: string;
}

export function DashboardChartEmpty({
  titleKey = "dashboard.analytics.empty",
}: DashboardChartEmptyProps) {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center dark:border-slate-700 dark:bg-slate-950/40">
      <p className="text-sm text-slate-500 dark:text-slate-400">{t(titleKey)}</p>
    </div>
  );
}
