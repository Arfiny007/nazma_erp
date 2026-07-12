"use client";

import { cn } from "@/lib/utils";

interface AuditUserBadgeProps {
  userName: string | null;
  role: string | null;
  className?: string;
}

const ROLE_TONE: Record<string, string> = {
  Super_Admin: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  Manager: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  Accounts: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  SR: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
};

export function AuditUserBadge({ userName, role, className }: AuditUserBadgeProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {userName ?? "—"}
      </span>
      {role ? (
        <span
          className={cn(
            "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
            ROLE_TONE[role] ??
              "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
          )}
        >
          {role.replace("_", " ")}
        </span>
      ) : null}
    </div>
  );
}
