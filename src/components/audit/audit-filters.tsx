"use client";

import { Search } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import type { AuditFilters } from "@/types/audit";

interface AuditFiltersBarProps {
  filters: AuditFilters;
  onChange: (filters: AuditFilters) => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

export const DEFAULT_AUDIT_FILTERS: AuditFilters = {
  page: 1,
  pageSize: 25,
};

export function AuditFiltersBar({
  filters,
  onChange,
  onSubmit,
  isLoading = false,
}: AuditFiltersBarProps) {
  const { t } = useLanguage();

  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t("audit.filters.search")}
          </span>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              onChange={(event) =>
                onChange({ ...filters, search: event.target.value, page: 1 })
              }
              placeholder={t("audit.filters.searchPlaceholder")}
              type="search"
              value={filters.search ?? ""}
            />
          </div>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t("audit.filters.action")}
          </span>
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            onChange={(event) =>
              onChange({ ...filters, action: event.target.value, page: 1 })
            }
            placeholder={t("audit.filters.actionPlaceholder")}
            value={filters.action ?? ""}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t("audit.filters.entityType")}
          </span>
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            onChange={(event) =>
              onChange({ ...filters, entityType: event.target.value, page: 1 })
            }
            placeholder={t("audit.filters.entityTypePlaceholder")}
            value={filters.entityType ?? ""}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t("audit.filters.fromDate")}
          </span>
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            onChange={(event) =>
              onChange({ ...filters, fromDate: event.target.value, page: 1 })
            }
            type="date"
            value={filters.fromDate ?? ""}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t("audit.filters.toDate")}
          </span>
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            onChange={(event) =>
              onChange({ ...filters, toDate: event.target.value, page: 1 })
            }
            type="date"
            value={filters.toDate ?? ""}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className="inline-flex items-center rounded-lg bg-[#1a5dad] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#164f94] disabled:opacity-60"
          disabled={isLoading}
          type="submit"
        >
          {t("audit.filters.apply")}
        </button>
        <button
          className="inline-flex items-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          disabled={isLoading}
          onClick={() => onChange({ ...DEFAULT_AUDIT_FILTERS })}
          type="button"
        >
          {t("audit.filters.clear")}
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("audit.filters.serverSideHint")}
        </p>
      </div>
    </form>
  );
}
