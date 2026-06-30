"use client";

import { Info } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface CollectionAdvanceBannerProps {
  unallocatedAmount: string;
  className?: string;
}

export function CollectionAdvanceBanner({
  unallocatedAmount,
  className,
}: CollectionAdvanceBannerProps) {
  const { t } = useLanguage();
  const hasAdvance = Number.parseFloat(unallocatedAmount) > 0;

  if (!hasAdvance) {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 to-indigo-50/50 px-4 py-3.5 dark:border-blue-900/50 dark:from-blue-950/40 dark:to-indigo-950/30",
        className,
      )}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/60">
        <Info aria-hidden="true" className="size-4 text-blue-600 dark:text-blue-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
          {t("collection.advance.bannerTitle")}
        </p>
        <p className="mt-0.5 text-sm text-blue-700/90 dark:text-blue-300/90">
          {t("collection.advance.bannerDescription")}
        </p>
      </div>
    </div>
  );
}

interface AdvanceCreditIndicatorProps {
  currentBalance: string;
  className?: string;
}

/** Blue indicator when dealer AR balance is negative (advance credit). Never an error. */
export function AdvanceCreditIndicator({
  currentBalance,
  className,
}: AdvanceCreditIndicatorProps) {
  const { t } = useLanguage();
  const balance = Number.parseFloat(currentBalance);

  if (balance >= 0) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/50 dark:text-blue-400 dark:ring-blue-500/30",
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-blue-500" />
      {t("collection.advance.creditIndicator")}
    </span>
  );
}
