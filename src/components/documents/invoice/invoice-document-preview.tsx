"use client";

import { Download, Printer, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import {
  InvoicePrintable,
  buildDocumentLabels,
  invoiceStatusLabel,
} from "@/components/documents/invoice/invoice-printable";
import { useDocumentPrint } from "@/lib/documents/use-document-print";
import { useLanguage } from "@/contexts/LanguageContext";
import type { InvoiceDetailDTO } from "@/types/invoice";

interface InvoiceDocumentPreviewProps {
  invoice: InvoiceDetailDTO;
  open: boolean;
  onClose: () => void;
  autoPrint?: boolean;
}

export function InvoiceDocumentPreview({
  invoice,
  open,
  onClose,
  autoPrint = false,
}: InvoiceDocumentPreviewProps) {
  const { t, locale } = useLanguage();
  const { printDocument, downloadPdf } = useDocumentPrint();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const labels = buildDocumentLabels(t);
  const statusLabel = invoiceStatusLabel(invoice.status, t);

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
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
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
      aria-label={t("document.invoice.previewTitle")}
      tabIndex={-1}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("document.invoice.previewTitle").replace("{invoiceNo}", invoice.invoiceNo)}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={printDocument}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Printer className="size-4" aria-hidden="true" />
            {t("document.actions.print")}
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
          >
            <Download className="size-4" aria-hidden="true" />
            {t("document.actions.downloadPdf")}
          </button>
          <button
            ref={closeButtonRef}
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
          <InvoicePrintable
            invoice={invoice}
            labels={labels}
            statusLabel={statusLabel}
            locale={locale}
          />
        </div>
      </div>
    </div>
  );
}
