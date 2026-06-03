"use client";

import { Package } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";

interface ProductEmptyStateProps {
  searchActive: boolean;
}

export function ProductEmptyState({ searchActive }: ProductEmptyStateProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 px-6 py-20 text-center dark:border-slate-800 dark:bg-slate-900/30">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <Package aria-hidden="true" className="size-5 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
        {searchActive
          ? t("products.empty.noResultsTitle")
          : t("products.empty.title")}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        {searchActive
          ? t("products.empty.noResultsDescription")
          : t("products.empty.description")}
      </p>
    </div>
  );
}
