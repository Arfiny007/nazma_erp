"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { StatementLedgerIntegrityDTO } from "@/types/ledger-statement";

interface LedgerIntegrityBadgeProps {
  integrity: StatementLedgerIntegrityDTO;
  className?: string;
}

export function LedgerIntegrityBadge({
  integrity,
  className,
}: LedgerIntegrityBadgeProps) {
  const { t } = useLanguage();
  const consistent = integrity.isConsistent;

  return (
    <span
      role="status"
      aria-label={
        consistent
          ? t("ledgerStatement.integrity.consistentAria")
          : t("ledgerStatement.integrity.warningAria")
      }
      title={
        consistent
          ? t("ledgerStatement.integrity.consistentHint")
          : t("ledgerStatement.integrity.warningHint")
      }
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        consistent
          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-500/30"
          : "bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-500/30",
        className,
      )}
    >
      {consistent ? (
        <ShieldCheck aria-hidden="true" className="size-3.5" />
      ) : (
        <AlertTriangle aria-hidden="true" className="size-3.5" />
      )}
      {consistent
        ? t("ledgerStatement.integrity.consistent")
        : t("ledgerStatement.integrity.warning")}
    </span>
  );
}
