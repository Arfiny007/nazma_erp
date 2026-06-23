"use client";

import {
  Ban,
  CheckCircle2,
  FilePlus2,
  PencilLine,
  Send,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { ApprovalHistoryDTO } from "@/types/order";

interface OrderHistoryTimelineProps {
  history: ApprovalHistoryDTO[];
}

const ACTION_ICON: Record<string, LucideIcon> = {
  CREATE: FilePlus2,
  SUBMIT: Send,
  UPDATE: PencilLine,
  APPROVE: CheckCircle2,
  REJECT: XCircle,
  CANCEL: Ban,
};

const ACTION_TONE: Record<string, string> = {
  CREATE: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  SUBMIT: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  APPROVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  REJECT: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
  CANCEL: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export function OrderHistoryTimeline({ history }: OrderHistoryTimelineProps) {
  const { t, locale } = useLanguage();

  const dateTimeFormatter = new Intl.DateTimeFormat(
    locale === "bn" ? "bn-BD" : "en-US",
    { dateStyle: "medium", timeStyle: "short" },
  );

  if (history.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
        {t("order.history.empty")}
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
        const actionLabel = t(`order.history.action.${entry.action}`);

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
                {actionLabel === `order.history.action.${entry.action}`
                  ? entry.action
                  : actionLabel}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("order.history.by")} {entry.actorName} ·{" "}
                {dateTimeFormatter.format(new Date(entry.timestamp))}
              </p>
              {entry.remarks && (
                <p className="mt-1 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  <span className="font-medium">{t("order.history.reason")}:</span>{" "}
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
