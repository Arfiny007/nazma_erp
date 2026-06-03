"use client";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProductStatusBadgeProps {
  isActive: boolean;
}

export function ProductStatusBadge({ isActive }: ProductStatusBadgeProps) {
  const { t } = useLanguage();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        isActive
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/20"
          : "bg-slate-100 text-slate-600 ring-1 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-500/20",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          isActive ? "bg-emerald-500 dark:bg-emerald-400" : "bg-slate-400 dark:bg-slate-500",
        )}
      />
      {isActive ? t("products.status.active") : t("products.status.inactive")}
    </span>
  );
}
