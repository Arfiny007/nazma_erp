"use client";

import { MapPin } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";

interface TerritoryMapEmptyProps {
  descriptionKey?: string;
}

export function TerritoryMapEmpty({
  descriptionKey = "dashboard.map.emptyDescription",
}: TerritoryMapEmptyProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <MapPin className="mb-3 h-8 w-8 text-slate-400" aria-hidden />
      <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
        {t("dashboard.map.empty")}
      </p>
      <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
        {t(descriptionKey)}
      </p>
    </div>
  );
}
