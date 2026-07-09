"use client";

import { BookOpen } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";

interface DealerStatementEmptyStateProps {
  /** True when date filters are active (dealer already selected). */
  filtersActive?: boolean;
  /** True when no dealer has been selected yet. */
  noDealerSelected?: boolean;
}

export function DealerStatementEmptyState({
  filtersActive,
  noDealerSelected = false,
}: DealerStatementEmptyStateProps) {
  const { t } = useLanguage();

  const title = noDealerSelected
    ? t("ledgerStatement.empty.selectDealerTitle")
    : filtersActive
      ? t("ledgerStatement.empty.noResultsTitle")
      : t("ledgerStatement.empty.title");

  const description = noDealerSelected
    ? t("ledgerStatement.empty.selectDealerDescription")
    : filtersActive
      ? t("ledgerStatement.empty.noResultsDescription")
      : t("ledgerStatement.empty.description");

  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900/40"
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <BookOpen
          aria-hidden="true"
          className="size-5 text-slate-400 dark:text-slate-500"
        />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
        {title}
      </h3>
      <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}
