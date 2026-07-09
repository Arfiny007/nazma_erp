"use client";

import { AlertTriangle, Landmark, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { listUninitializedDealers } from "@/lib/actions/opening-balance/list-uninitialized-dealers";
import { useFormatMoney } from "@/lib/utils/use-format-money";
import type { UninitializedDealerDTO } from "@/types/opening-balance";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; items: UninitializedDealerDTO[]; total: number; pageCount: number }
  | { status: "error" };

interface UninitializedDealersTableProps {
  onSelect: (dealer: UninitializedDealerDTO) => void;
  pageSize?: number;
}

/**
 * Dealer Selection surface for the Financial Initialization wizard — lists
 * ONLY dealers with no `OpeningBalance` row (see `listUninitializedDealers`).
 * A dealer disappears from this list the instant a Draft is created for
 * them, matching the "initialized exactly once" business rule.
 */
export function UninitializedDealersTable({
  onSelect,
  pageSize = 10,
}: UninitializedDealersTableProps) {
  const { t, locale } = useLanguage();
  const formatMoney = useFormatMoney(locale);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const result = await listUninitializedDealers({ search: search || undefined, page, pageSize });
    if (result.success) {
      setState({
        status: "ready",
        items: result.data.items,
        total: result.data.total,
        pageCount: result.data.pageCount,
      });
    } else {
      setState({ status: "error" });
    }
  }, [search, page, pageSize]);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(handle);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
          placeholder={t("openingBalance.wizard.dealerSearchPlaceholder")}
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>

      {state.status === "loading" ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white py-16 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          {t("common.loading")}
        </div>
      ) : state.status === "error" ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-rose-200/80 bg-rose-50/50 py-16 text-center dark:border-rose-900/60 dark:bg-rose-950/30">
          <AlertTriangle aria-hidden="true" className="size-5 text-rose-500 dark:text-rose-400" />
          <span className="text-sm font-medium text-rose-600 dark:text-rose-400">
            {t("openingBalance.error.loadFailed")}
          </span>
        </div>
      ) : state.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Landmark aria-hidden="true" className="size-5 text-slate-400 dark:text-slate-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {search
              ? t("openingBalance.list.noResultsTitle")
              : t("openingBalance.list.allInitializedTitle")}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {search
              ? t("openingBalance.list.noResultsDescription")
              : t("openingBalance.list.allInitializedDescription")}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t("openingBalance.column.dealerCode")}</th>
                  <th className="px-4 py-3">{t("openingBalance.column.dealerName")}</th>
                  <th className="px-4 py-3">{t("openingBalance.column.territory")}</th>
                  <th className="px-4 py-3 text-right">{t("openingBalance.column.creditLimit")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {state.items.map((dealer) => (
                  <tr
                    key={dealer.id}
                    className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
                      {dealer.dealerCode}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {dealer.companyName}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {dealer.territory}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                      {formatMoney(dealer.creditLimit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelect(dealer)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        {t("openingBalance.actions.startInitialization")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {state.pageCount > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>
                {t("openingBalance.list.totalUninitialized").replace(
                  "{count}",
                  String(state.total),
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium disabled:opacity-40 dark:border-slate-700"
                >
                  {t("common.previous")}
                </button>
                <span className="text-xs">
                  {page} / {state.pageCount}
                </span>
                <button
                  type="button"
                  disabled={page >= state.pageCount}
                  onClick={() => setPage((p) => Math.min(state.pageCount, p + 1))}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium disabled:opacity-40 dark:border-slate-700"
                >
                  {t("common.next")}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
