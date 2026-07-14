"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import type { NotificationTemplateDTO } from "@/types/notification";

interface NotificationTemplatesTableProps {
  records: NotificationTemplateDTO[];
}

export function NotificationTemplatesTable({
  records,
}: NotificationTemplatesTableProps) {
  const { t } = useLanguage();

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950/60">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("notifications.templates.table.key")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("notifications.templates.table.locale")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("notifications.templates.table.channel")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("notifications.templates.table.preview")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {records.map((record) => (
              <tr
                key={record.id}
                className="hover:bg-slate-50/80 dark:hover:bg-slate-950/40"
              >
                <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {record.key}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {t(`notifications.locale.${record.locale}`)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {t(`notifications.channel.${record.channel}`)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  <div className="font-medium text-slate-800 dark:text-slate-100">
                    {record.subject}
                  </div>
                  <pre className="mt-1 max-w-xl whitespace-pre-wrap text-xs text-slate-500 dark:text-slate-400">
                    {record.body.slice(0, 200)}
                    {record.body.length > 200 ? "…" : ""}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
