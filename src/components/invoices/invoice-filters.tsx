"use client";

import { InvoiceStatus } from "@prisma/client";
import { X } from "lucide-react";

import { DealerCombobox } from "@/components/orders/dealer-combobox";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { DealerDTO } from "@/types/dealer";
import { INVOICE_STATUSES } from "./invoice-status-badge";

interface InvoiceFiltersProps {
  statusFilter: InvoiceStatus | "";
  dealerFilter: DealerDTO | null;
  dateFrom: string;
  dateTo: string;
  onStatusChange: (value: InvoiceStatus | "") => void;
  onDealerChange: (dealer: DealerDTO | null) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClear: () => void;
  filtersActive: boolean;
}

export function InvoiceFilters({
  statusFilter,
  dealerFilter,
  dateFrom,
  dateTo,
  onStatusChange,
  onDealerChange,
  onDateFromChange,
  onDateToChange,
  onClear,
  filtersActive,
}: InvoiceFiltersProps) {
  const { t } = useLanguage();

  const filterControl =
    "rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <select
        aria-label={t("invoice.filters.status")}
        value={statusFilter}
        onChange={(event) => onStatusChange(event.target.value as InvoiceStatus | "")}
        className={cn(filterControl, "cursor-pointer appearance-none")}
      >
        <option value="">{t("invoice.filters.allStatuses")}</option>
        {INVOICE_STATUSES.map((value) => (
          <option key={value} value={value}>
            {t(`invoice.status.${value}`)}
          </option>
        ))}
      </select>

      <DealerCombobox value={dealerFilter} onChange={onDealerChange} allowClear />

      <input
        type="date"
        aria-label={t("invoice.filters.dateFrom")}
        value={dateFrom}
        onChange={(event) => onDateFromChange(event.target.value)}
        className={filterControl}
      />

      <input
        type="date"
        aria-label={t("invoice.filters.dateTo")}
        value={dateTo}
        onChange={(event) => onDateToChange(event.target.value)}
        className={filterControl}
      />

      {filtersActive && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 sm:col-span-2 lg:col-span-4"
        >
          <X aria-hidden="true" className="size-4" />
          {t("invoice.filters.clear")}
        </button>
      )}
    </div>
  );
}
