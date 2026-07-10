"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import type { FinancialIntegrityScanRecord } from "@/lib/ledger/monitor";

interface IntegritySummaryCardsProps {
  scan: FinancialIntegrityScanRecord;
}

/**
 * KPI cards sourced exclusively from persisted `FinancialIntegrityScan` data.
 */
export function IntegritySummaryCards({ scan }: IntegritySummaryCardsProps) {
  const { t } = useLanguage();

  const cards = [
    {
      id: "consistent",
      label: t("integrityConsole.cards.consistent"),
      value: scan.consistentDealers,
      tone: "text-emerald-700 dark:text-emerald-400",
    },
    {
      id: "drifted",
      label: t("integrityConsole.cards.drifted"),
      value: scan.driftedDealers,
      tone:
        scan.driftedDealers > 0
          ? "text-amber-700 dark:text-amber-400"
          : "text-slate-900 dark:text-slate-50",
    },
    {
      id: "missing",
      label: t("integrityConsole.cards.missingLedger"),
      value: scan.missingLedgerDealers,
      tone:
        scan.missingLedgerDealers > 0
          ? "text-red-700 dark:text-red-400"
          : "text-slate-900 dark:text-slate-50",
    },
    {
      id: "corrupted",
      label: t("integrityConsole.cards.corrupted"),
      value: scan.corruptedDealers,
      tone:
        scan.corruptedDealers > 0
          ? "text-purple-700 dark:text-purple-400"
          : "text-slate-900 dark:text-slate-50",
    },
    {
      id: "total",
      label: t("integrityConsole.cards.totalDealers"),
      value: scan.totalDealers,
      tone: "text-slate-900 dark:text-slate-50",
    },
  ];

  return (
    <section
      aria-label={t("integrityConsole.cards.sectionLabel")}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
    >
      {cards.map((card) => (
        <article
          className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          key={card.id}
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {card.label}
          </p>
          <p
            className={`mt-1.5 text-xl font-semibold tabular-nums ${card.tone}`}
          >
            {card.value}
          </p>
        </article>
      ))}
    </section>
  );
}
