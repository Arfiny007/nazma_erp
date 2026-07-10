"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { useFormatMoney } from "@/lib/utils/use-format-money";
import type { DealerReconciliationResult } from "@/lib/ledger/reconciliation";

import { IntegrityDealerStatusBadge } from "./integrity-dealer-status-badge";
import {
  filterIntegrityDealers,
  integrityDealerFiltersActive,
  type IntegrityDealerFilters,
} from "./integrity-console-utils";

interface IntegrityDealerTableProps {
  dealers: DealerReconciliationResult[];
  filters: IntegrityDealerFilters;
}

export function IntegrityDealerTable({
  dealers,
  filters,
}: IntegrityDealerTableProps) {
  const { t, locale } = useLanguage();
  const formatMoney = useFormatMoney(locale);

  const filteredDealers = filterIntegrityDealers(dealers, filters);
  const filtersActive = integrityDealerFiltersActive(filters);

  return (
    <section aria-labelledby="integrity-dealers-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2
          className="text-sm font-semibold text-slate-900 dark:text-slate-50"
          id="integrity-dealers-title"
        >
          {t("integrityConsole.dealers.title")}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("integrityConsole.dealers.readOnlyHint")}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left dark:border-slate-800 dark:bg-slate-900/60">
              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                {t("integrityConsole.dealers.colCode")}
              </th>
              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                {t("integrityConsole.dealers.colName")}
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-slate-600 dark:text-slate-400">
                {t("integrityConsole.dealers.colDealerBalance")}
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-slate-600 dark:text-slate-400">
                {t("integrityConsole.dealers.colLedgerBalance")}
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-slate-600 dark:text-slate-400">
                {t("integrityConsole.dealers.colDrift")}
              </th>
              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                {t("integrityConsole.dealers.colStatus")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredDealers.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-8 text-center text-slate-500 dark:text-slate-400"
                  colSpan={6}
                >
                  {filtersActive
                    ? t("integrityConsole.dealers.emptyFiltered")
                    : t("integrityConsole.dealers.empty")}
                </td>
              </tr>
            ) : (
              filteredDealers.map((dealer) => (
                <tr
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  key={dealer.dealerCode}
                >
                  <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-50">
                    {dealer.dealerCode}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                    {dealer.dealerName}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatMoney(dealer.dealerBalance)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatMoney(dealer.latestLedgerBalance)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatMoney(dealer.drift)}
                  </td>
                  <td className="px-3 py-2.5">
                    <IntegrityDealerStatusBadge status={dealer.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
