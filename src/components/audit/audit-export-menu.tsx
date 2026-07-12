"use client";

import { FileArchive, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useState } from "react";

import {
  exportAuditArchive,
  exportAuditExcel,
  exportAuditPdf,
} from "@/lib/actions/audit";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AuditFilters } from "@/types/audit";

import { AuditExportDialog } from "./audit-export-dialog";
import { AuditExportProgress } from "./audit-export-progress";
import { downloadAuditExportFile } from "./audit-export-utils";

type ExportKind = "pdf" | "excel" | "archive";

interface AuditExportMenuProps {
  filters: AuditFilters;
  disabled?: boolean;
}

export function AuditExportMenu({ filters, disabled = false }: AuditExportMenuProps) {
  const { t } = useLanguage();
  const [pendingKind, setPendingKind] = useState<ExportKind | null>(null);
  const [confirmKind, setConfirmKind] = useState<ExportKind | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [recordCount, setRecordCount] = useState<number | null>(null);

  const runExport = async (kind: ExportKind) => {
    setPendingKind(kind);
    setErrorKey(null);
    setRecordCount(null);

    const action =
      kind === "pdf"
        ? exportAuditPdf
        : kind === "excel"
          ? exportAuditExcel
          : exportAuditArchive;

    const result = await action(filters);
    setPendingKind(null);

    if (!result.success) {
      setErrorKey(result.error.messageKey);
      return;
    }

    setRecordCount(result.data.recordCount);
    downloadAuditExportFile(result.data);
  };

  const handleConfirm = () => {
    if (!confirmKind) {
      return;
    }
    const kind = confirmKind;
    setConfirmKind(null);
    void runExport(kind);
  };

  const buttons: Array<{
    kind: ExportKind;
    label: string;
    icon: typeof FileText;
  }> = [
    { kind: "pdf", label: t("audit.export.pdf"), icon: FileText },
    { kind: "excel", label: t("audit.export.excel"), icon: FileSpreadsheet },
    { kind: "archive", label: t("audit.export.archive"), icon: FileArchive },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {buttons.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            disabled={disabled || pendingKind !== null}
            onClick={() => setConfirmKind(kind)}
            type="button"
          >
            {pendingKind === kind ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Icon className="size-4" aria-hidden="true" />
            )}
            {label}
          </button>
        ))}
      </div>

      <AuditExportProgress
        isExporting={pendingKind !== null}
        kind={pendingKind}
        recordCount={recordCount}
      />

      {errorKey ? (
        <p className="text-sm text-red-600 dark:text-red-400">{t(errorKey)}</p>
      ) : null}

      <AuditExportDialog
        kind={confirmKind}
        onCancel={() => setConfirmKind(null)}
        onConfirm={handleConfirm}
        open={confirmKind !== null}
      />
    </div>
  );
}
