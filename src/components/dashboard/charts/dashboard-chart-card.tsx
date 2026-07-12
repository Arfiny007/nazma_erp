"use client";

import type { ReactNode } from "react";

import { useLanguage } from "@/contexts/LanguageContext";

interface DashboardChartCardProps {
  titleKey: string;
  children: ReactNode;
}

export function DashboardChartCard({ titleKey, children }: DashboardChartCardProps) {
  const { t } = useLanguage();

  return (
    <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
        {t(titleKey)}
      </h3>
      {children}
    </article>
  );
}
