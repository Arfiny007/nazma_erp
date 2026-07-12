"use client";

import { useLanguage } from "@/contexts/LanguageContext";

type ExportKind = "pdf" | "excel" | "archive";

interface AuditExportDialogProps {
  open: boolean;
  kind: ExportKind | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const KIND_TITLE_KEYS: Record<ExportKind, string> = {
  pdf: "audit.export.dialog.pdfTitle",
  excel: "audit.export.dialog.excelTitle",
  archive: "audit.export.dialog.archiveTitle",
};

const KIND_DESCRIPTION_KEYS: Record<ExportKind, string> = {
  pdf: "audit.export.dialog.pdfDescription",
  excel: "audit.export.dialog.excelDescription",
  archive: "audit.export.dialog.archiveDescription",
};

export function AuditExportDialog({
  open,
  kind,
  onConfirm,
  onCancel,
}: AuditExportDialogProps) {
  const { t } = useLanguage();

  if (!open || !kind) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-export-dialog-title"
      >
        <h2
          className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          id="audit-export-dialog-title"
        >
          {t(KIND_TITLE_KEYS[kind])}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t(KIND_DESCRIPTION_KEYS[kind])}
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {t("audit.export.dialog.filterHint")}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
            onClick={onCancel}
            type="button"
          >
            {t("audit.export.dialog.cancel")}
          </button>
          <button
            className="rounded-lg bg-[#1a5dad] px-4 py-2 text-sm font-medium text-white hover:bg-[#164f94]"
            onClick={onConfirm}
            type="button"
          >
            {t("audit.export.dialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
