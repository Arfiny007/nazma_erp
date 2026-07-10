"use client";

import { useEffect, useState } from "react";

import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDealerOwnershipHistory, getCurrentDealerOwnership } from "@/lib/actions/dealer-ownership";
import type { DealerOwnershipRecord } from "@/lib/dealers/ownership/ownership-types";

interface DealerOwnershipTimelineProps {
  dealerId: string;
}

type LoadStatus = "loading" | "ready" | "error";

export function DealerOwnershipTimeline({ dealerId }: DealerOwnershipTimelineProps) {
  const { t, locale } = useLanguage();
  const [history, setHistory] = useState<DealerOwnershipRecord[]>([]);
  const [current, setCurrent] = useState<DealerOwnershipRecord | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setStatus("loading");

      const [historyResult, currentResult] = await Promise.all([
        getDealerOwnershipHistory({ dealerId }),
        getCurrentDealerOwnership({ dealerId }),
      ]);

      if (cancelled) {
        return;
      }

      if (!historyResult.success || !currentResult.success) {
        setStatus("error");
        return;
      }

      setHistory(historyResult.data);
      setCurrent(currentResult.data);
      setStatus("ready");
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [dealerId]);

  const displayTerritory = (record: DealerOwnershipRecord) =>
    locale === "bn" && record.territoryNameBn
      ? record.territoryNameBn
      : record.territoryName;

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  if (status === "loading") {
    return <TableSkeleton rows={4} columns={5} />;
  }

  if (status === "error") {
    return (
      <p className="text-sm text-red-600">{t("dealer.ownership.page.loadError")}</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t("dealer.ownership.current.title")}
        </h2>
        {current ? (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t("dealer.ownership.column.territory")}</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {displayTerritory(current)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("dealer.ownership.column.sr")}</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {current.assignedSrName ?? t("dealer.ownership.unassigned")}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("dealer.ownership.column.location")}</dt>
              <dd className="text-slate-700 dark:text-slate-200">
                {current.districtName}, {current.divisionName}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("dealer.ownership.column.since")}</dt>
              <dd className="text-slate-700 dark:text-slate-200">
                {formatDate(current.effectiveFrom)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-500">{t("dealer.ownership.current.empty")}</p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-900/60">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                {t("dealer.ownership.column.territory")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                {t("dealer.ownership.column.sr")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                {t("dealer.ownership.column.period")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                {t("dealer.ownership.column.status")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                {t("dealer.ownership.column.reason")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  {t("dealer.ownership.history.empty")}
                </td>
              </tr>
            ) : (
              history.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-50">
                    {displayTerritory(row)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    {row.assignedSrName ?? t("dealer.ownership.unassigned")}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    {formatDate(row.effectiveFrom)}
                    {row.effectiveTo ? ` → ${formatDate(row.effectiveTo)}` : ""}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {row.isActive
                      ? t("dealer.ownership.status.active")
                      : t("dealer.ownership.status.closed")}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {row.reason ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
