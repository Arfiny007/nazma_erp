"use client";

import { useCallback, useEffect, useRef } from "react";
import { Printer, X } from "lucide-react";

import {
  buildStatementDocumentLabels,
  DealerStatementPrintable,
} from "@/components/documents/statement/dealer-statement-printable";
import { useDocumentPrint } from "@/lib/documents/use-document-print";
import { useLanguage } from "@/contexts/LanguageContext";
import type { DealerStatementDTO } from "@/types/ledger-statement";

interface DealerStatementDocumentPreviewProps {
  statement: DealerStatementDTO;
  open: boolean;
  onClose: () => void;
  autoPrint?: boolean;
}

/** Modal preview for printable Dealer Statements — print only, no export. */
export function DealerStatementDocumentPreview({
  statement,
  open,
  onClose,
  autoPrint = false,
}: DealerStatementDocumentPreviewProps) {
  const { t, locale } = useLanguage();
  const { printDocument } = useDocumentPrint();
  const dialogRef = useRef<HTMLDivElement>(null);

  const labels = buildStatementDocumentLabels(t);
  const postingTypeLabel = (postingType: string) =>
    t(`ledgerStatement.postingType.${postingType}`);
  const integrityLabel = (consistent: boolean) =>
    consistent
      ? t("ledgerStatement.integrity.consistent")
      : t("ledgerStatement.integrity.warning");

  const previewTitle = labels.previewTitle.replace(
    "{dealerName}",
    statement.meta.dealerName,
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    window.document.addEventListener("keydown", handleKeyDown);
    window.document.body.style.overflow = "hidden";
    return () => {
      window.document.removeEventListener("keydown", handleKeyDown);
      window.document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  useEffect(() => {
    if (open && autoPrint) {
      const timer = window.setTimeout(() => printDocument(), 400);
      return () => window.clearTimeout(timer);
    }
  }, [open, autoPrint, printDocument]);

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      className="no-print fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={previewTitle}
      tabIndex={-1}
    >
      <div className="no-print flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {previewTitle}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={printDocument}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
          >
            <Printer className="size-4" aria-hidden="true" />
            {t("document.actions.print")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={t("document.actions.close")}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 justify-center overflow-auto p-4 md:p-8">
        <div className="doc-preview-scale">
          <DealerStatementPrintable
            statement={statement}
            labels={labels}
            locale={locale}
            postingTypeLabel={postingTypeLabel}
            integrityLabel={integrityLabel}
          />
        </div>
      </div>
    </div>
  );
}
