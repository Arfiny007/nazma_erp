"use client";

import type { OrderStatus } from "@prisma/client";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

/**
 * Enterprise status pill for a sales order. Each lifecycle status maps to a
 * distinct, accessible colour treatment with a leading status dot.
 */
const STATUS_STYLES: Record<OrderStatus, { badge: string; dot: string }> = {
  Draft: {
    badge:
      "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-500/30",
    dot: "bg-slate-400 dark:bg-slate-500",
  },
  Pending_Approval: {
    badge:
      "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-400 dark:ring-amber-500/30",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
  Approved: {
    badge:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-500/30",
    dot: "bg-emerald-500 dark:bg-emerald-400",
  },
  Partially_Delivered: {
    badge:
      "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/50 dark:text-sky-400 dark:ring-sky-500/30",
    dot: "bg-sky-500 dark:bg-sky-400",
  },
  Rejected: {
    badge:
      "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-400 dark:ring-rose-500/30",
    dot: "bg-rose-500 dark:bg-rose-400",
  },
  Cancelled: {
    badge:
      "bg-slate-100 text-slate-500 ring-slate-500/20 line-through decoration-slate-400/70 dark:bg-slate-800/80 dark:text-slate-400 dark:ring-slate-500/30",
    dot: "bg-slate-400 dark:bg-slate-500",
  },
  Delivered: {
    badge:
      "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/50 dark:text-blue-400 dark:ring-blue-500/30",
    dot: "bg-blue-500 dark:bg-blue-400",
  },
};

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
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
      {t(`order.status.${status}`)}
    </span>
  );
}
