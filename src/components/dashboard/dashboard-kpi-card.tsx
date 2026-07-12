"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { DashboardKpi } from "@/types/dashboard";

interface DashboardKpiCardProps {
  kpi: DashboardKpi;
}

const toneClasses = {
  default: "text-slate-900 dark:text-slate-50",
  success: "text-emerald-700 dark:text-emerald-400",
  warning: "text-amber-700 dark:text-amber-400",
  danger: "text-red-700 dark:text-red-400",
} as const;

export function DashboardKpiCard({ kpi }: DashboardKpiCardProps) {
  const { t } = useLanguage();
  const tone = kpi.tone ?? "default";

  return (
    <article className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm transition-colors hover:border-brand-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-800">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {t(kpi.labelKey)}
      </p>
      <p
        className={cn(
          "mt-1.5 text-xl font-semibold tabular-nums",
          toneClasses[tone],
        )}
      >
        {kpi.value}
      </p>
    </article>
  );
}
