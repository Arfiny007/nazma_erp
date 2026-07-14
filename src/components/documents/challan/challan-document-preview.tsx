"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  ChallanPrintable,
  buildChallanDocumentLabels,
  challanStatusLabel,
} from "@/components/documents/challan/challan-printable";
import { DocumentPrintToolbar } from "@/components/documents/toolbar/document-print-toolbar";
import { useDocumentPrint } from "@/lib/documents/use-document-print";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ChallanDetailLineDTO, DeliveryChallanDetailDTO } from "@/types/delivery-challan";

interface ChallanDocumentPreviewProps {
  challan: DeliveryChallanDetailDTO;
  detailLines: ChallanDetailLineDTO[];
  open: boolean;
  onClose: () => void;
  autoPrint?: boolean;
}

export function ChallanDocumentPreview({
  challan,
  detailLines,
  open,
  onClose,
  autoPrint = false,
}: ChallanDocumentPreviewProps) {
  const { t, locale } = useLanguage();
  const { printDocument, downloadPdf } = useDocumentPrint();
  const dialogRef = useRef<HTMLDivElement>(null);

  const labels = buildChallanDocumentLabels(t);
  const statusLabel = challanStatusLabel(challan.status, t);
  const deliveryModeLabel = t(`challan.deliveryMode.${challan.deliveryMode}`);

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
      aria-label={t("document.challan.previewTitle").replace("{challanNo}", challan.challanNo)}
      tabIndex={-1}
    >
      <DocumentPrintToolbar
        title={t("document.challan.previewTitle").replace("{challanNo}", challan.challanNo)}
        onPrint={printDocument}
        onDownloadPdf={downloadPdf}
        onClose={onClose}
        printLabel={t("document.actions.print")}
        downloadLabel={t("document.actions.downloadPdf")}
        closeLabel={t("document.actions.close")}
      />

      <div className="flex flex-1 justify-center overflow-auto p-4 md:p-8">
        <div className="doc-preview-scale">
          <ChallanPrintable
            challan={challan}
            detailLines={detailLines}
            labels={labels}
            statusLabel={statusLabel}
            deliveryModeLabel={deliveryModeLabel}
            locale={locale}
          />
        </div>
      </div>
    </div>
  );
}
