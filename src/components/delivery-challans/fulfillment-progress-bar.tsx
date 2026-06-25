"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface FulfillmentProgressBarProps {
  percent: string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Enterprise-grade horizontal fulfillment progress indicator with percentage.
 */
export function FulfillmentProgressBar({
  percent,
  label,
  size = "md",
  className,
}: FulfillmentProgressBarProps) {
  const { t } = useLanguage();
  const numeric = Math.min(100, Math.max(0, Number.parseFloat(percent) || 0));
  const displayPercent = numeric.toFixed(0);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        {label ? (
          <span className="font-medium text-slate-600 dark:text-slate-400">
            {label}
          </span>
        ) : (
          <span />
        )}
        <span className="tabular-nums font-semibold text-slate-900 dark:text-slate-100">
          {displayPercent}%
        </span>
      </div>
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800",
          size === "sm" ? "h-1.5" : "h-2.5",
        )}
        role="progressbar"
        aria-valuenow={numeric}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? t("challan.fulfillment.progress")}
      >
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500 ease-out",
            numeric >= 100 && "from-emerald-500 to-emerald-600",
          )}
          style={{ width: `${numeric}%` }}
        />
      </div>
    </div>
  );
}
