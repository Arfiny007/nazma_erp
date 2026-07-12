"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import type { AuditRecord } from "@/types/audit";

import { AuditActionBadge } from "./audit-action-badge";
import { AuditUserBadge } from "./audit-user-badge";

interface AuditTableProps {
  records: AuditRecord[];
}

function formatMetadataPreview(metadata: Record<string, unknown>): string {
  const parts: string[] = [];
  const dealerCode = metadata.dealerCode;
  const referenceNo = metadata.referenceNo ?? metadata.collectionNo ?? metadata.invoiceNo;
  if (typeof dealerCode === "string") {
    parts.push(dealerCode);
  }
  if (typeof referenceNo === "string") {
    parts.push(referenceNo);
  }
  return parts.join(" · ");
}

export function AuditTable({ records }: AuditTableProps) {
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
                {t("audit.table.when")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("audit.table.action")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("audit.table.entity")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("audit.table.user")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("audit.table.details")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-950/40">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {formatter.format(new Date(record.createdAt))}
                </td>
                <td className="px-4 py-3">
                  <AuditActionBadge action={record.action} />
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                  <div className="font-medium">{record.entityType}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {record.entityId}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <AuditUserBadge role={record.role} userName={record.userName} />
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {formatMetadataPreview(record.metadata) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
