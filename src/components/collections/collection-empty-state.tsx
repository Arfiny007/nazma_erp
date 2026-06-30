"use client";

import { Wallet } from "lucide-react";
import Link from "next/link";

import { useLanguage } from "@/contexts/LanguageContext";

interface CollectionEmptyStateProps {
  filtersActive: boolean;
  canCreate?: boolean;
}

export function CollectionEmptyState({
  filtersActive,
  canCreate = false,
}: CollectionEmptyStateProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <Wallet aria-hidden="true" className="size-5 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
        {filtersActive
          ? t("collection.empty.noResultsTitle")
          : t("collection.empty.title")}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        {filtersActive
          ? t("collection.empty.noResultsDescription")
          : t("collection.empty.description")}
      </p>
      {!filtersActive && canCreate && (
        <Link
          href="/collections/new"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {t("collection.actions.new")}
        </Link>
      )}
    </div>
  );
}
