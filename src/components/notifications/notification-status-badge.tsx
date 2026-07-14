"use client";

import type { NotificationStatus } from "@prisma/client";

import { useLanguage } from "@/contexts/LanguageContext";

const STATUS_STYLES: Record<NotificationStatus, string> = {
  PENDING:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300",
  PROCESSING:
    "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300",
  SENT: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300",
  FAILED: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/40 dark:text-red-300",
  CANCELLED:
    "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300",
};

interface NotificationStatusBadgeProps {
  status: NotificationStatus;
}

export function NotificationStatusBadge({ status }: NotificationStatusBadgeProps) {
  const { t } = useLanguage();

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {t(`notifications.status.${status}`)}
    </span>
  );
}
