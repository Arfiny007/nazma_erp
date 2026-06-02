"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { CreditStatusLevel } from "@/types/dealer";

interface DealerCreditBadgeProps {
  /** Severity band derived from credit utilization. */
  status: CreditStatusLevel;
  /** Utilization percentage (0 when no limit configured). */
  utilizationPercent: number;
  className?: string;
}

const STATUS_STYLES: Record<CreditStatusLevel, string> = {
  green:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-500/30",
  yellow:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-400 dark:ring-amber-500/30",
  red: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-400 dark:ring-rose-500/30",
};

const DOT_STYLES: Record<CreditStatusLevel, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-rose-500",
};

const STATUS_LABEL_KEY: Record<CreditStatusLevel, string> = {
  green: "dealers.credit.green",
  yellow: "dealers.credit.yellow",
  red: "dealers.credit.red",
};

/**
 * Compact, accessible badge that communicates a dealer's credit utilization
 * band (green / yellow / red) alongside the precise utilization percentage.
 */
export function DealerCreditBadge({
  status,
  utilizationPercent,
  className,
}: DealerCreditBadgeProps) {
  const { t } = useLanguage();

  const label = t(STATUS_LABEL_KEY[status]);
  const percent = `${utilizationPercent.toFixed(0)}%`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLES[status],
        className,
      )}
      title={`${label} · ${percent}`}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", DOT_STYLES[status])}
      />
      <span>{label}</span>
      <span className="tabular-nums opacity-70">{percent}</span>
    </span>
  );
}
