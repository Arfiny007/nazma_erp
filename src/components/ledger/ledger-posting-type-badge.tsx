"use client";

import type { LedgerPostingType } from "@prisma/client";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface LedgerPostingTypeBadgeProps {
  postingType: LedgerPostingType;
  className?: string;
}

const POSTING_TYPE_STYLES: Record<
  LedgerPostingType,
  { badge: string; dot: string }
> = {
  Issue: {
    badge:
      "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-500/30",
    dot: "bg-slate-500 dark:bg-slate-400",
  },
  Collection: {
    badge:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-500/30",
    dot: "bg-emerald-500 dark:bg-emerald-400",
  },
  Reversal: {
    badge:
      "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-400 dark:ring-amber-500/30",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
  OpeningBalance: {
    badge:
      "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/50 dark:text-blue-400 dark:ring-blue-500/30",
    dot: "bg-blue-500 dark:bg-blue-400",
  },
  CreditNote: {
    badge:
      "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950/50 dark:text-violet-400 dark:ring-violet-500/30",
    dot: "bg-violet-500 dark:bg-violet-400",
  },
  DebitNote: {
    badge:
      "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-950/50 dark:text-orange-400 dark:ring-orange-500/30",
    dot: "bg-orange-500 dark:bg-orange-400",
  },
  ManualAdjustment: {
    badge:
      "bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-950/50 dark:text-cyan-400 dark:ring-cyan-500/30",
    dot: "bg-cyan-500 dark:bg-cyan-400",
  },
  JournalEntry: {
    badge:
      "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-950/50 dark:text-indigo-400 dark:ring-indigo-500/30",
    dot: "bg-indigo-500 dark:bg-indigo-400",
  },
  Adjustment: {
    badge:
      "bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-950/50 dark:text-teal-400 dark:ring-teal-500/30",
    dot: "bg-teal-500 dark:bg-teal-400",
  },
};

export const LEDGER_POSTING_TYPES = [
  "Issue",
  "Collection",
  "Reversal",
  "OpeningBalance",
  "CreditNote",
  "DebitNote",
  "ManualAdjustment",
  "JournalEntry",
  "Adjustment",
] as const satisfies readonly LedgerPostingType[];

export function LedgerPostingTypeBadge({
  postingType,
  className,
}: LedgerPostingTypeBadgeProps) {
  const { t } = useLanguage();
  const style = POSTING_TYPE_STYLES[postingType];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        style.badge,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", style.dot)} />
      {t(`ledgerStatement.postingType.${postingType}`)}
    </span>
  );
}
