"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import type { AuditSummary } from "@/types/audit";

interface AuditSummaryCardsProps {
  summary: AuditSummary;
}

const CARD_CONFIG = [
  { key: "totalEvents", labelKey: "audit.summary.totalEvents", tone: "default" },
  {
    key: "financialEvents",
    labelKey: "audit.summary.financialEvents",
    tone: "financial",
  },
  {
    key: "securityEvents",
    labelKey: "audit.summary.securityEvents",
    tone: "security",
  },
  { key: "dealerEvents", labelKey: "audit.summary.dealerEvents", tone: "dealer" },
  {
    key: "integrityEvents",
    labelKey: "audit.summary.integrityEvents",
    tone: "integrity",
  },
] as const;

const TONE_CLASS: Record<string, string> = {
  default: "border-slate-200 dark:border-slate-800",
  financial: "border-blue-200 dark:border-blue-900/60",
  security: "border-violet-200 dark:border-violet-900/60",
  dealer: "border-amber-200 dark:border-amber-900/60",
  integrity: "border-emerald-200 dark:border-emerald-900/60",
};

export function AuditSummaryCards({ summary }: AuditSummaryCardsProps) {
  const { t } = useLanguage();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {CARD_CONFIG.map((card) => (
        <div
          key={card.key}
          className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${TONE_CLASS[card.tone]}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t(card.labelKey)}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {summary[card.key].toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
