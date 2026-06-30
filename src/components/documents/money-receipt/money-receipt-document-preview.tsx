"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  MoneyReceiptPrintable,
  buildMoneyReceiptLabels,
  collectionPaymentMethodLabel,
  collectionStatusLabel,
  financialReferenceTypeLabel,
} from "@/components/documents/money-receipt/money-receipt-printable";
import { DocumentPrintToolbar } from "@/components/documents/toolbar/document-print-toolbar";
import { useDocumentPrint } from "@/lib/documents/use-document-print";
import { useLanguage } from "@/contexts/LanguageContext";
import type { MoneyReceiptDocumentDTO } from "@/types/document";

interface MoneyReceiptDocumentPreviewProps {
  document: MoneyReceiptDocumentDTO;
  open: boolean;
  onClose: () => void;
  autoPrint?: boolean;
}

export function MoneyReceiptDocumentPreview({
  document,
  open,
  onClose,
  autoPrint = false,
}: MoneyReceiptDocumentPreviewProps) {
  const { t, locale } = useLanguage();
  const { printDocument, downloadPdf } = useDocumentPrint();
  const dialogRef = useRef<HTMLDivElement>(null);

  const labels = buildMoneyReceiptLabels(t);
  const statusLabel = collectionStatusLabel(document.status, t);
  const paymentMethodLabel = collectionPaymentMethodLabel(document.paymentMethod, t);
  const referenceTypeLabel = (type: string) => financialReferenceTypeLabel(type, t);

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
      aria-label={labels.previewTitle.replace("{collectionNo}", document.collectionNo)}
      tabIndex={-1}
    >
      <DocumentPrintToolbar
        title={labels.previewTitle.replace("{collectionNo}", document.collectionNo)}
        onPrint={printDocument}
        onDownloadPdf={downloadPdf}
        onClose={onClose}
        printLabel={t("document.actions.print")}
        downloadLabel={t("document.actions.downloadPdf")}
        closeLabel={t("document.actions.close")}
      />

      <div className="flex flex-1 justify-center overflow-auto p-4 md:p-8">
        <div className="doc-preview-scale">
          <MoneyReceiptPrintable
            document={document}
            labels={labels}
            statusLabel={statusLabel}
            paymentMethodLabel={paymentMethodLabel}
            referenceTypeLabel={referenceTypeLabel}
            locale={locale}
          />
        </div>
      </div>
    </div>
  );
}
