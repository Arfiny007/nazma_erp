"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import type { AuditTimelineGroup } from "@/types/audit";

import { AuditActionBadge } from "./audit-action-badge";
import { AuditUserBadge } from "./audit-user-badge";

interface AuditTimelineProps {
  groups: AuditTimelineGroup[];
}

export function AuditTimeline({ groups }: AuditTimelineProps) {
  const { t, locale } = useLanguage();
  const formatter = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("audit.timeline.title")}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("audit.timeline.orderHint")}
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.key} className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t(group.labelKey)}
          </h3>
          <ol className="space-y-3">
            {group.records.map((record) => (
              <li
                key={record.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <AuditActionBadge action={record.action} />
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      {record.entityType} · {record.entityId}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatter.format(new Date(record.createdAt))}
                    </p>
                  </div>
                  <AuditUserBadge role={record.role} userName={record.userName} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
