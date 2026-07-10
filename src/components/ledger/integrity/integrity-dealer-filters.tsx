"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import type { DealerReconciliationStatus } from "@/lib/ledger/reconciliation";

import {
  DEFAULT_INTEGRITY_DEALER_FILTERS,
  type IntegrityDealerFilters,
} from "./integrity-console-utils";

const STATUS_OPTIONS: Array<IntegrityDealerFilters["status"]> = [
  "ALL",
  "CONSISTENT",
  "DRIFT",
  "MISSING_LEDGER",
  "CORRUPTED_CHAIN",
];

interface IntegrityDealerFiltersBarProps {
  filters: IntegrityDealerFilters;
  onChange: (filters: IntegrityDealerFilters) => void;
}

export function IntegrityDealerFiltersBar({
  filters,
  onChange,
}: IntegrityDealerFiltersBarProps) {
  const { t } = useLanguage();

  return (
    <section
      aria-label={t("integrityConsole.dealers.filtersLabel")}
      className="grid gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <label className="space-y-1.5 text-sm">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {t("integrityConsole.dealers.filterStatus")}
        </span>
        <select
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          onChange={(event) =>
            onChange({
              ...filters,
              status: event.target.value as IntegrityDealerFilters["status"],
            })
          }
          value={filters.status}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status === "ALL"
                ? t("integrityConsole.dealers.allStatuses")
                : t(`integrityConsole.dealerStatus.${status}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1.5 text-sm sm:col-span-2">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {t("integrityConsole.dealers.filterSearch")}
        </span>
        <input
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          onChange={(event) =>
            onChange({ ...filters, search: event.target.value })
          }
          placeholder={t("integrityConsole.dealers.searchPlaceholder")}
          type="search"
          value={filters.search}
        />
      </label>

      <label className="space-y-1.5 text-sm">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {t("integrityConsole.dealers.filterFromDate")}
        </span>
        <input
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
          disabled
          title={t("integrityConsole.dealers.futureReadyHint")}
          type="date"
          value={filters.fromDate}
        />
      </label>

      <div className="flex items-end sm:col-span-2 lg:col-span-4">
        <button
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => onChange({ ...DEFAULT_INTEGRITY_DEALER_FILTERS })}
          type="button"
        >
          {t("integrityConsole.dealers.clearFilters")}
        </button>
      </div>
    </section>
  );
}

export type { DealerReconciliationStatus };
