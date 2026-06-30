"use client";

import { FileText, Receipt, RotateCcw, Wallet, type LucideIcon } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { CollectionHistoryDTO } from "@/types/collection";

interface CollectionHistoryTimelineProps {
  history: CollectionHistoryDTO[];
}

const ACTION_ICON: Record<string, LucideIcon> = {
  COLLECTION_CREATED: Wallet,
  COLLECTION_CONFIRMED: Receipt,
  COLLECTION_ALLOCATED: FileText,
  COLLECTION_DEALLOCATED: RotateCcw,
  COLLECTION_REVERSED: RotateCcw,
  COLLECTION_REVERSED_MISALLOCATION: RotateCcw,
};

const ACTION_TONE: Record<string, string> = {
  COLLECTION_CREATED:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  COLLECTION_CONFIRMED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  COLLECTION_ALLOCATED:
    "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  COLLECTION_DEALLOCATED:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  COLLECTION_REVERSED:
    "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
  COLLECTION_REVERSED_MISALLOCATION:
    "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
};

export function CollectionHistoryTimeline({ history }: CollectionHistoryTimelineProps) {
  const { t, locale } = useLanguage();

  const dateTimeFormatter = new Intl.DateTimeFormat(
    locale === "bn" ? "bn-BD" : "en-US",
    { dateStyle: "medium", timeStyle: "short" },
  );

  if (history.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
        {t("collection.history.empty")}
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
        const actionLabel = t(`collection.history.action.${entry.action}`);

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
                {actionLabel === `collection.history.action.${entry.action}`
                  ? entry.action
                  : actionLabel}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("collection.history.by")} {entry.actorName} ·{" "}
                {dateTimeFormatter.format(new Date(entry.timestamp))}
              </p>
              {entry.remarks && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {entry.remarks}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
