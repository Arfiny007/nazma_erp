"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import type { FinancialIntegrityScanRecord } from "@/lib/ledger/monitor";
import { cn } from "@/lib/utils";

import {
  filterIntegrityScans,
  formatIntegrityDuration,
  type IntegrityScanHistoryFilters,
} from "./integrity-console-utils";

interface IntegrityScanHistoryTableProps {
  scans: FinancialIntegrityScanRecord[];
  filters: IntegrityScanHistoryFilters;
  selectedScanId: string | null;
  onSelectScan: (scanId: string) => void;
}

function scanExecutionBadge(status: FinancialIntegrityScanRecord["status"]) {
  return status === "Completed"
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
    : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400";
}

export function IntegrityScanHistoryTable({
  scans,
  filters,
  selectedScanId,
  onSelectScan,
}: IntegrityScanHistoryTableProps) {
  const { t, locale } = useLanguage();

  const dateFormatter = new Intl.DateTimeFormat(
    locale === "bn" ? "bn-BD" : "en-GB",
    { dateStyle: "medium", timeStyle: "short" },
  );

  const filteredScans = filterIntegrityScans(scans, filters);

  return (
    <section aria-labelledby="integrity-history-title" className="space-y-3">
      <h2
        className="text-sm font-semibold text-slate-900 dark:text-slate-50"
        id="integrity-history-title"
      >
        {t("integrityConsole.history.title")}
      </h2>

      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left dark:border-slate-800 dark:bg-slate-900/60">
              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                {t("integrityConsole.history.colStarted")}
              </th>
              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                {t("integrityConsole.history.colCompleted")}
              </th>
              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                {t("integrityConsole.history.colDuration")}
              </th>
              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                {t("integrityConsole.history.colConsistent")}
              </th>
              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                {t("integrityConsole.history.colDrifted")}
              </th>
              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                {t("integrityConsole.history.colMissing")}
              </th>
              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                {t("integrityConsole.history.colCorrupted")}
              </th>
              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                {t("integrityConsole.history.colStatus")}
              </th>
              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                {t("integrityConsole.history.colActions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredScans.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-8 text-center text-slate-500 dark:text-slate-400"
                  colSpan={9}
                >
                  {t("integrityConsole.history.empty")}
                </td>
              </tr>
            ) : (
              filteredScans.map((scan) => (
                <tr
                  className={cn(
                    "border-b border-slate-100 last:border-0 dark:border-slate-800",
                    selectedScanId === scan.scanId && "bg-slate-50 dark:bg-slate-800/50",
                  )}
                  key={scan.scanId}
                >
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                    {dateFormatter.format(new Date(scan.startedAt))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                    {dateFormatter.format(new Date(scan.completedAt))}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatIntegrityDuration(scan.durationMs)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{scan.consistentDealers}</td>
                  <td className="px-3 py-2.5 tabular-nums">{scan.driftedDealers}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {scan.missingLedgerDealers}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{scan.corruptedDealers}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                        scanExecutionBadge(scan.status),
                      )}
                    >
                      {t(`integrityConsole.scanStatus.${scan.status}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline dark:text-slate-300"
                      onClick={() => onSelectScan(scan.scanId)}
                      type="button"
                    >
                      {t("integrityConsole.history.view")}
                    </button>
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
