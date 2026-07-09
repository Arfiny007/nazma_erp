"use client";

import { DealerCombobox } from "@/components/orders/dealer-combobox";
import { LEDGER_POSTING_TYPES } from "@/components/ledger/ledger-posting-type-badge";
import { LEDGER_REFERENCE_TYPES } from "@/components/ledger/ledger-reference-type-badge";
import {
  resolveStatementQuickFilter,
  type StatementQuickFilter,
} from "@/components/ledger/statement-row-styles";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { DealerDTO } from "@/types/dealer";

const QUICK_FILTERS: StatementQuickFilter[] = [
  "all",
  "thisMonth",
  "last30",
  "thisQuarter",
  "ytd",
];

interface DealerStatementFiltersProps {
  dealer: DealerDTO | null;
  fromDate: string;
  toDate: string;
  postingType: string;
  referenceType: string;
  search: string;
  quickFilter: StatementQuickFilter;
  filtersActive: boolean;
  onDealerChange: (dealer: DealerDTO | null) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onPostingTypeChange: (value: string) => void;
  onReferenceTypeChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onQuickFilterChange: (value: StatementQuickFilter) => void;
  onClear: () => void;
  onRefresh: () => void;
}

export function DealerStatementFilters({
  dealer,
  fromDate,
  toDate,
  postingType,
  referenceType,
  search,
  quickFilter,
  filtersActive,
  onDealerChange,
  onFromDateChange,
  onToDateChange,
  onPostingTypeChange,
  onReferenceTypeChange,
  onSearchChange,
  onQuickFilterChange,
  onClear,
  onRefresh,
}: DealerStatementFiltersProps) {
  const { t } = useLanguage();

  const handleQuickFilter = (preset: StatementQuickFilter) => {
    onQuickFilterChange(preset);
    const resolved = resolveStatementQuickFilter(preset);
    if (!resolved) {
      onFromDateChange("");
      onToDateChange("");
      return;
    }
    onFromDateChange(resolved.fromDate);
    onToDateChange(resolved.toDate);
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div
        role="group"
        aria-label={t("ledgerStatement.filters.quickFilters")}
        className="flex flex-wrap gap-1.5"
      >
        {QUICK_FILTERS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handleQuickFilter(preset)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              quickFilter === preset
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800",
            )}
          >
            {t(`ledgerStatement.filters.quick.${preset}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-[1.4]">
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("ledgerStatement.filters.dealer")}
          </span>
          <DealerCombobox
            value={dealer}
            onChange={onDealerChange}
            allowClear
            activeOnly
          />
        </div>

        <div className="min-w-[130px]">
          <label
            htmlFor="ledger-from-date"
            className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {t("ledgerStatement.filters.fromDate")}
          </label>
          <input
            id="ledger-from-date"
            type="date"
            value={fromDate}
            onChange={(event) => {
              onQuickFilterChange("all");
              onFromDateChange(event.target.value);
            }}
            className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="min-w-[130px]">
          <label
            htmlFor="ledger-to-date"
            className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {t("ledgerStatement.filters.toDate")}
          </label>
          <input
            id="ledger-to-date"
            type="date"
            value={toDate}
            onChange={(event) => {
              onQuickFilterChange("all");
              onToDateChange(event.target.value);
            }}
            className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="min-w-[150px] flex-1">
          <label
            htmlFor="ledger-posting-type"
            className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {t("ledgerStatement.filters.postingType")}
          </label>
          <select
            id="ledger-posting-type"
            value={postingType}
            onChange={(event) => onPostingTypeChange(event.target.value)}
            className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">{t("ledgerStatement.filters.allPostingTypes")}</option>
            {LEDGER_POSTING_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`ledgerStatement.postingType.${type}`)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
            {t("ledgerStatement.filters.futureReadyHint")}
          </p>
        </div>

        <div className="min-w-[150px] flex-1">
          <label
            htmlFor="ledger-reference-type"
            className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {t("ledgerStatement.filters.referenceType")}
          </label>
          <select
            id="ledger-reference-type"
            value={referenceType}
            onChange={(event) => onReferenceTypeChange(event.target.value)}
            className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">{t("ledgerStatement.filters.allReferenceTypes")}</option>
            {LEDGER_REFERENCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`ledgerStatement.referenceType.${type}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[180px] flex-1">
          <label
            htmlFor="ledger-search"
            className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {t("ledgerStatement.filters.search")}
          </label>
          <input
            id="ledger-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("ledgerStatement.filters.searchPlaceholder")}
            className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={!dealer}
          className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {t("ledgerStatement.filters.refresh")}
        </button>
      </div>

      {filtersActive && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
          >
            {t("ledgerStatement.filters.clear")}
          </button>
        </div>
      )}
    </div>
  );
}
