"use client";

import { Loader2 } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";

type ExportKind = "pdf" | "excel" | "archive";

interface AuditExportProgressProps {
  isExporting: boolean;
  kind: ExportKind | null;
  recordCount: number | null;
}

const KIND_PROGRESS_KEYS: Record<ExportKind, string> = {
  pdf: "audit.export.progress.pdf",
  excel: "audit.export.progress.excel",
  archive: "audit.export.progress.archive",
};

export function AuditExportProgress({
  isExporting,
  kind,
  recordCount,
}: AuditExportProgressProps) {
  const { t } = useLanguage();

  if (!isExporting && recordCount === null) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
      role="status"
    >
      {isExporting ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>
            {kind ? t(KIND_PROGRESS_KEYS[kind]) : t("audit.export.progress.generic")}
          </span>
        </>
      ) : (
        <span>
          {t("audit.export.progress.complete").replace(
            "{{count}}",
            String(recordCount ?? 0),
          )}
        </span>
      )}
    </div>
  );
}
