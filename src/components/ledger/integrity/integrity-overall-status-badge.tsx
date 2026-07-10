"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

import type { OverallHealthStatus } from "./integrity-console-utils";

interface IntegrityOverallStatusBadgeProps {
  status: OverallHealthStatus;
  className?: string;
}

export function IntegrityOverallStatusBadge({
  status,
  className,
}: IntegrityOverallStatusBadgeProps) {
  const { t } = useLanguage();

  if (status === "unknown") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300",
          className,
        )}
        role="status"
      >
        {t("integrityConsole.status.unknown")}
      </span>
    );
  }

  const healthy = status === "healthy";

  return (
    <span
      aria-label={
        healthy
          ? t("integrityConsole.status.healthyAria")
          : t("integrityConsole.status.issuesAria")
      }
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        healthy
          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-500/30"
          : "bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-500/30",
        className,
      )}
      role="status"
    >
      {healthy ? (
        <ShieldCheck aria-hidden="true" className="size-3.5" />
      ) : (
        <AlertTriangle aria-hidden="true" className="size-3.5" />
      )}
      {healthy
        ? t("integrityConsole.status.healthy")
        : t("integrityConsole.status.issues")}
    </span>
  );
}
