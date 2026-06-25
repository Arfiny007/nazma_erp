"use client";

import { DELIVERY_CHALLAN_STATUSES } from "@/types/delivery-challan";
import type { DeliveryChallanStatus } from "@/types/delivery-challan";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface ChallanStatusBadgeProps {
  status: DeliveryChallanStatus;
  className?: string;
}

const STATUS_STYLES: Record<DeliveryChallanStatus, { badge: string; dot: string }> =
  {
    Draft: {
      badge:
        "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-500/30",
      dot: "bg-slate-400 dark:bg-slate-500",
    },
    Confirmed: {
      badge:
        "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-500/30",
      dot: "bg-emerald-500 dark:bg-emerald-400",
    },
    Cancelled: {
      badge:
        "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-400 dark:ring-rose-500/30",
      dot: "bg-rose-500 dark:bg-rose-400",
    },
  };

export function ChallanStatusBadge({ status, className }: ChallanStatusBadgeProps) {
  const { t } = useLanguage();
  const style = STATUS_STYLES[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        style.badge,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", style.dot)} />
      {t(`challan.status.${status}`)}
    </span>
  );
}

export { DELIVERY_CHALLAN_STATUSES };
