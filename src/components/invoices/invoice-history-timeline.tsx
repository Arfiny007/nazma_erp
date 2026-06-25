"use client";

import { FileText, Receipt, type LucideIcon } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { InvoiceHistoryDTO } from "@/types/invoice";

interface InvoiceHistoryTimelineProps {
  history: InvoiceHistoryDTO[];
}

const ACTION_ICON: Record<string, LucideIcon> = {
  INVOICE_CREATED: Receipt,
};

const ACTION_TONE: Record<string, string> = {
  INVOICE_CREATED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
};

export function InvoiceHistoryTimeline({ history }: InvoiceHistoryTimelineProps) {
  const { t, locale } = useLanguage();

  const dateTimeFormatter = new Intl.DateTimeFormat(
    locale === "bn" ? "bn-BD" : "en-US",
    { dateStyle: "medium", timeStyle: "short" },
  );

  if (history.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
        {t("invoice.history.empty")}
      </p>
    );
  }

  return (
    <ol className="space-y-0 px-5 py-4">
      {history.map((entry, index) => {
        const Icon = ACTION_ICON[entry.action] ?? FileText;
        const tone =
          ACTION_TONE[entry.action] ??
          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
        const isLast = index === history.length - 1;
        const actionLabel = t(`invoice.history.action.${entry.action}`);

        return (
          <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-slate-200 dark:bg-slate-700"
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
                tone,
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {actionLabel === `invoice.history.action.${entry.action}`
                  ? entry.action
                  : actionLabel}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("invoice.history.by")} {entry.actorName} ·{" "}
                {dateTimeFormatter.format(new Date(entry.timestamp))}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
