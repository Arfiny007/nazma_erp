"use client";

import { CollectionPaymentMethod, CollectionStatus } from "@prisma/client";

import { DealerCombobox } from "@/components/orders/dealer-combobox";
import { COLLECTION_STATUSES } from "@/components/collections/collection-status-badge";
import { useLanguage } from "@/contexts/LanguageContext";
import type { DealerDTO } from "@/types/dealer";

const PAYMENT_METHODS = [
  CollectionPaymentMethod.Cash,
  CollectionPaymentMethod.Bank,
  CollectionPaymentMethod.Cheque,
  CollectionPaymentMethod.MobileBanking,
  CollectionPaymentMethod.OnlineTransfer,
  CollectionPaymentMethod.Other,
] as const;

interface CollectionFiltersProps {
  statusFilter: CollectionStatus | "";
  paymentMethodFilter: CollectionPaymentMethod | "";
  dealerFilter: DealerDTO | null;
  dateFrom: string;
  dateTo: string;
  advanceOnly: boolean;
  onStatusChange: (value: CollectionStatus | "") => void;
  onPaymentMethodChange: (value: CollectionPaymentMethod | "") => void;
  onDealerChange: (dealer: DealerDTO | null) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onAdvanceOnlyChange: (value: boolean) => void;
  onClear: () => void;
  filtersActive: boolean;
}

export function CollectionFilters({
  statusFilter,
  paymentMethodFilter,
  dealerFilter,
  dateFrom,
  dateTo,
  advanceOnly,
  onStatusChange,
  onPaymentMethodChange,
  onDealerChange,
  onDateFromChange,
  onDateToChange,
  onAdvanceOnlyChange,
  onClear,
  filtersActive,
}: CollectionFiltersProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[140px] flex-1">
          <label
            htmlFor="collection-status-filter"
            className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {t("collection.filters.status")}
          </label>
          <select
            id="collection-status-filter"
            value={statusFilter}
            onChange={(event) =>
              onStatusChange(event.target.value as CollectionStatus | "")
            }
            className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">{t("collection.filters.allStatuses")}</option>
            {COLLECTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`collection.status.${status}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[140px] flex-1">
          <label
            htmlFor="collection-payment-filter"
            className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {t("collection.filters.paymentMethod")}
          </label>
          <select
            id="collection-payment-filter"
            value={paymentMethodFilter}
            onChange={(event) =>
              onPaymentMethodChange(event.target.value as CollectionPaymentMethod | "")
            }
            className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">{t("collection.filters.allPaymentMethods")}</option>
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {t(`collection.paymentMethod.${method}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[200px] flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("collection.filters.dealer")}
          </span>
          <DealerCombobox
            value={dealerFilter}
            onChange={onDealerChange}
            allowClear
          />
        </div>

        <div className="min-w-[130px]">
          <label
            htmlFor="collection-date-from"
            className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {t("collection.filters.dateFrom")}
          </label>
          <input
            id="collection-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="min-w-[130px]">
          <label
            htmlFor="collection-date-to"
            className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {t("collection.filters.dateTo")}
          </label>
          <input
            id="collection-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={advanceOnly}
            onChange={(event) => onAdvanceOnlyChange(event.target.checked)}
            className="size-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 dark:border-slate-600"
          />
          {t("collection.filters.advanceOnly")}
        </label>
      </div>

      {filtersActive && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
          >
            {t("collection.filters.clear")}
          </button>
        </div>
      )}
    </div>
  );
}
