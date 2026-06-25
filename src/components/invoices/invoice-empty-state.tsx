"use client";

import { Receipt } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";

interface InvoiceEmptyStateProps {
  filtersActive: boolean;
}

export function InvoiceEmptyState({ filtersActive }: InvoiceEmptyStateProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 px-6 py-20 text-center dark:border-slate-800 dark:bg-slate-900/30">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <Receipt aria-hidden="true" className="size-5 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
        {filtersActive ? t("invoice.empty.noResultsTitle") : t("invoice.empty.title")}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        {filtersActive
          ? t("invoice.empty.noResultsDescription")
          : t("invoice.empty.description")}
      </p>
    </div>
  );
}
