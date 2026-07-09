"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";

interface DealerStatementAlertProps {
  messageKey: string;
  onRetry?: () => void;
}

export function DealerStatementAlert({
  messageKey,
  onRetry,
}: DealerStatementAlertProps) {
  const { t } = useLanguage();

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400"
        />
        <p>{t(messageKey)}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-800 shadow-sm transition-colors hover:bg-rose-50 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100 dark:hover:bg-rose-900"
        >
          <RefreshCw aria-hidden="true" className="size-3.5" />
          {t("ledgerStatement.error.retry")}
        </button>
      )}
    </div>
  );
}
