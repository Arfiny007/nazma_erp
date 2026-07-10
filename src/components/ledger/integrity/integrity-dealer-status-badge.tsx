"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { DealerReconciliationStatus } from "@/lib/ledger/reconciliation";

const STATUS_STYLES: Record<DealerReconciliationStatus, string> = {
  CONSISTENT:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-400",
  DRIFT:
    "bg-orange-50 text-orange-800 ring-orange-600/20 dark:bg-orange-950/50 dark:text-orange-300",
  MISSING_LEDGER:
    "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/50 dark:text-red-400",
  CORRUPTED_CHAIN:
    "bg-purple-50 text-purple-800 ring-purple-600/20 dark:bg-purple-950/50 dark:text-purple-300",
};

interface IntegrityDealerStatusBadgeProps {
  status: DealerReconciliationStatus;
}

export function IntegrityDealerStatusBadge({
  status,
}: IntegrityDealerStatusBadgeProps) {
  const { t } = useLanguage();

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ring-black/5",
        STATUS_STYLES[status],
      )}
    >
      {t(`integrityConsole.dealerStatus.${status}`)}
    </span>
  );
}
