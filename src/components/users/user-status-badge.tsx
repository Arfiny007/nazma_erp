"use client";

import type { UserLifecycleStatus } from "@prisma/client";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<UserLifecycleStatus, string> = {
  INVITED:
    "bg-sky-50 text-sky-700 ring-1 ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-300",
  PENDING_ACTIVATION:
    "bg-amber-50 text-amber-800 ring-1 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300",
  ACTIVE:
    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400",
  DISABLED:
    "bg-slate-100 text-slate-600 ring-1 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-400",
  ARCHIVED:
    "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-300",
};

interface UserStatusBadgeProps {
  status: UserLifecycleStatus;
  className?: string;
}

export function UserStatusBadge({ status, className }: UserStatusBadgeProps) {
  const { t } = useLanguage();
  const labelKey = `userManagement.status.${status}`;
  const label = t(labelKey);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_TONE[status],
        className,
      )}
    >
      {label}
    </span>
  );
}
