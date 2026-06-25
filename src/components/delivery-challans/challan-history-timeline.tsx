"use client";

import {
  Ban,
  FilePlus2,
  PencilLine,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { ChallanHistoryDTO } from "@/types/delivery-challan";

interface ChallanHistoryTimelineProps {
  history: ChallanHistoryDTO[];
}

const ACTION_ICON: Record<string, LucideIcon> = {
  DELIVERY_CHALLAN_CREATED: FilePlus2,
  DELIVERY_CHALLAN_UPDATED: PencilLine,
  DELIVERY_CHALLAN_CONFIRMED: Truck,
  DELIVERY_CHALLAN_CANCELLED: Ban,
};

const ACTION_TONE: Record<string, string> = {
  DELIVERY_CHALLAN_CREATED:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  DELIVERY_CHALLAN_UPDATED:
    "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  DELIVERY_CHALLAN_CONFIRMED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  DELIVERY_CHALLAN_CANCELLED:
    "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
};

export function ChallanHistoryTimeline({ history }: ChallanHistoryTimelineProps) {
  const { t, locale } = useLanguage();

  const dateTimeFormatter = new Intl.DateTimeFormat(
    locale === "bn" ? "bn-BD" : "en-US",
    { dateStyle: "medium", timeStyle: "short" },
  );

  if (history.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
        {t("challan.history.empty")}
      </p>
    );
  }

  return (
    <ol className="space-y-0 px-5 py-4">
      {history.map((entry, index) => {
        const Icon = ACTION_ICON[entry.action] ?? PencilLine;
        const tone =
          ACTION_TONE[entry.action] ??
          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
        const isLast = index === history.length - 1;
        const actionLabel = t(`challan.history.action.${entry.action}`);
        const statusTransition =
          entry.fromStatus && entry.toStatus
            ? `${t(`challan.status.${entry.fromStatus}`)} → ${t(`challan.status.${entry.toStatus}`)}`
            : entry.toStatus
              ? t(`challan.status.${entry.toStatus}`)
              : null;

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
                {actionLabel === `challan.history.action.${entry.action}`
                  ? entry.action
                  : actionLabel}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("challan.history.by")} {entry.actorName} ·{" "}
                {dateTimeFormatter.format(new Date(entry.timestamp))}
              </p>
              {statusTransition && (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {statusTransition}
                </p>
              )}
              {entry.remarks && (
                <p className="mt-1 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  <span className="font-medium">{t("challan.history.remarks")}:</span>{" "}
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
