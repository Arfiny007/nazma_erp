"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface AuditActionBadgeProps {
  action: string;
  className?: string;
}

const ACTION_TONE: Record<string, string> = {
  INVOICE_CREATED:
    "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  COLLECTION_CONFIRMED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  COLLECTION_REVERSED:
    "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  DEALER_BALANCE_UPDATED:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  DEALER_BALANCE_DECREASED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  DEALER_OPENING_BALANCE_POSTED:
    "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  FINANCIAL_INTEGRITY_SCAN:
    "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

export function AuditActionBadge({ action, className }: AuditActionBadgeProps) {
  const { t } = useLanguage();
  const labelKey = `audit.action.${action}`;
  const label = t(labelKey);
  const display = label === labelKey ? action : label;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        ACTION_TONE[action] ??
          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        className,
      )}
    >
      {display}
    </span>
  );
}
