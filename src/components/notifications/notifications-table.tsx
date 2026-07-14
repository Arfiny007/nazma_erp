"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import type { NotificationDTO } from "@/types/notification";

import { NotificationStatusBadge } from "./notification-status-badge";

interface NotificationsTableProps {
  records: NotificationDTO[];
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
  canRetry?: boolean;
  canCancel?: boolean;
  isLoading?: boolean;
}

export function NotificationsTable({
  records,
  onRetry,
  onCancel,
  canRetry = false,
  canCancel = false,
  isLoading = false,
}: NotificationsTableProps) {
  const { t, locale } = useLanguage();
  const formatter = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950/60">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("notifications.table.recipient")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("notifications.table.type")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("notifications.table.channel")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("notifications.table.status")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("notifications.table.retries")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("notifications.table.created")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("notifications.table.sent")}
              </th>
              {(canRetry || canCancel) && (
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("notifications.table.actions")}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {records.map((record) => (
              <tr
                key={record.id}
                className="hover:bg-slate-50/80 dark:hover:bg-slate-950/40"
              >
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                  <div className="font-medium">{record.recipient}</div>
                  {record.subject ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {record.subject}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {t(`notifications.type.${record.type}`)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {t(`notifications.channel.${record.channel}`)}
                </td>
                <td className="px-4 py-3">
                  <NotificationStatusBadge status={record.status} />
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {record.retryCount} / {record.maxRetries}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {formatter.format(new Date(record.createdAt))}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {record.sentAt ? formatter.format(new Date(record.sentAt)) : "—"}
                </td>
                {(canRetry || canCancel) && (
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      {canRetry && record.status === "FAILED" ? (
                        <button
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                          disabled={isLoading}
                          onClick={() => onRetry?.(record.id)}
                          type="button"
                        >
                          {t("notifications.action.retry")}
                        </button>
                      ) : null}
                      {canCancel && record.status === "PENDING" ? (
                        <button
                          className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                          disabled={isLoading}
                          onClick={() => onCancel?.(record.id)}
                          type="button"
                        >
                          {t("notifications.action.cancel")}
                        </button>
                      ) : null}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
