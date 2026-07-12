"use client";

import { useLanguage } from "@/contexts/LanguageContext";

export function TerritoryMapSkeleton() {
  const { t } = useLanguage();

  return (
    <div
      className="animate-pulse space-y-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      aria-busy="true"
      aria-label={t("dashboard.map.loading")}
    >
      <div className="flex gap-3">
        <div className="h-9 w-32 rounded-md bg-slate-200 dark:bg-slate-700" />
        <div className="h-9 w-32 rounded-md bg-slate-200 dark:bg-slate-700" />
        <div className="h-9 w-24 rounded-md bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-slate-100 dark:bg-slate-800"
          />
        ))}
      </div>
    </div>
  );
}
