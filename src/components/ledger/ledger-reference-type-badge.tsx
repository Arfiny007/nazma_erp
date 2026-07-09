"use client";

import type { FinancialReferenceType } from "@prisma/client";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface LedgerReferenceTypeBadgeProps {
  referenceType: FinancialReferenceType;
  className?: string;
}

const REFERENCE_TYPE_STYLES: Record<
  FinancialReferenceType,
  { badge: string; dot: string }
> = {
  Invoice: {
    badge:
      "bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-500/25",
    dot: "bg-slate-400 dark:bg-slate-500",
  },
  Collection: {
    badge:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/25",
    dot: "bg-emerald-500 dark:bg-emerald-400",
  },
  OpeningBalance: {
    badge:
      "bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-500/25",
    dot: "bg-blue-500 dark:bg-blue-400",
  },
  CreditNote: {
    badge:
      "bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-950/40 dark:text-violet-400 dark:ring-violet-500/25",
    dot: "bg-violet-500 dark:bg-violet-400",
  },
  DebitNote: {
    badge:
      "bg-orange-50 text-orange-700 ring-orange-600/15 dark:bg-orange-950/40 dark:text-orange-400 dark:ring-orange-500/25",
    dot: "bg-orange-500 dark:bg-orange-400",
  },
  ManualAdjustment: {
    badge:
      "bg-cyan-50 text-cyan-700 ring-cyan-600/15 dark:bg-cyan-950/40 dark:text-cyan-400 dark:ring-cyan-500/25",
    dot: "bg-cyan-500 dark:bg-cyan-400",
  },
  JournalEntry: {
    badge:
      "bg-indigo-50 text-indigo-700 ring-indigo-600/15 dark:bg-indigo-950/40 dark:text-indigo-400 dark:ring-indigo-500/25",
    dot: "bg-indigo-500 dark:bg-indigo-400",
  },
};

export const LEDGER_REFERENCE_TYPES = [
  "Invoice",
  "Collection",
  "OpeningBalance",
  "CreditNote",
  "DebitNote",
  "ManualAdjustment",
  "JournalEntry",
] as const satisfies readonly FinancialReferenceType[];

export function LedgerReferenceTypeBadge({
  referenceType,
  className,
}: LedgerReferenceTypeBadgeProps) {
  const { t } = useLanguage();
  const style = REFERENCE_TYPE_STYLES[referenceType];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        style.badge,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", style.dot)} />
      {t(`ledgerStatement.referenceType.${referenceType}`)}
    </span>
  );
}
