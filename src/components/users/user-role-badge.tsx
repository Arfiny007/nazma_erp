"use client";

import type { UserRole } from "@prisma/client";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const ROLE_TONE: Record<UserRole, string> = {
  Super_Admin:
    "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  Manager:
    "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  Accounts:
    "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300",
  SR: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

interface UserRoleBadgeProps {
  role: UserRole;
  className?: string;
}

export function UserRoleBadge({ role, className }: UserRoleBadgeProps) {
  const { t } = useLanguage();
  const labelKey = `userManagement.role.${role}`;
  const label = t(labelKey);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        ROLE_TONE[role],
        className,
      )}
    >
      {label}
    </span>
  );
}
