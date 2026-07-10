"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import type { FinancialIntegrityScanRecord } from "@/lib/ledger/monitor";

import {
  deriveOverallHealthStatus,
  formatIntegrityDuration,
} from "./integrity-console-utils";
import { IntegrityOverallStatusBadge } from "./integrity-overall-status-badge";

interface IntegrityConsoleHeaderProps {
  latestScan: FinancialIntegrityScanRecord | null;
}

export function IntegrityConsoleHeader({ latestScan }: IntegrityConsoleHeaderProps) {
  const { t, locale } = useLanguage();

  const dateFormatter = new Intl.DateTimeFormat(
    locale === "bn" ? "bn-BD" : "en-GB",
    { dateStyle: "medium", timeStyle: "short" },
  );

  const overallStatus = deriveOverallHealthStatus(latestScan);

  return (
    <section
      aria-labelledby="integrity-console-title"
      className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between dark:border-slate-800">
        <div className="min-w-0 space-y-1">
          <h1
            className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50"
            id="integrity-console-title"
          >
            {t("integrityConsole.title")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("integrityConsole.subtitle")}
          </p>
        </div>
        <IntegrityOverallStatusBadge status={overallStatus} />
      </div>

      <dl className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4 dark:bg-slate-800">
        <HeaderCell
          label={t("integrityConsole.header.lastScanTime")}
          value={
            latestScan
              ? dateFormatter.format(new Date(latestScan.completedAt))
              : t("integrityConsole.header.noScan")
          }
        />
        <HeaderCell
          label={t("integrityConsole.header.scanDuration")}
          value={
            latestScan
              ? formatIntegrityDuration(latestScan.durationMs)
              : "—"
          }
          isNumeric
        />
        <HeaderCell
          label={t("integrityConsole.header.totalDealers")}
          value={latestScan ? String(latestScan.totalDealers) : "—"}
          isNumeric
        />
        <HeaderCell
          label={t("integrityConsole.header.overallStatus")}
          value={
            overallStatus === "unknown"
              ? t("integrityConsole.status.unknown")
              : overallStatus === "healthy"
                ? t("integrityConsole.status.healthy")
                : t("integrityConsole.status.issues")
          }
          isText
        />
      </dl>
    </section>
  );
}

function HeaderCell({
  label,
  value,
  isNumeric,
  isText,
}: {
  label: string;
  value: string;
  isNumeric?: boolean;
  isText?: boolean;
}) {
  return (
    <div className="bg-white px-5 py-3.5 dark:bg-slate-900">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd
        className={
          isNumeric
            ? "mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50"
            : isText
              ? "mt-1 text-sm font-medium text-slate-900 dark:text-slate-50"
              : "mt-1 text-sm tabular-nums text-slate-900 dark:text-slate-50"
        }
      >
        {value}
      </dd>
    </div>
  );
}
