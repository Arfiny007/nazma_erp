"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";

import { DocumentPrintToolbar } from "@/components/documents/toolbar/document-print-toolbar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentPrint } from "@/lib/documents/use-document-print";
import type { TerritoryProductSalesPrintPayloadDTO } from "@/types/product-sales-territory";

import { buildTerritoryProductSalesDocumentLabels } from "./product-sales-document-labels";
import { TerritoryProductSalesDocument } from "./territory-product-sales-document";

interface TerritoryProductSalesDocumentPreviewProps {
  payload: TerritoryProductSalesPrintPayloadDTO;
  open: boolean;
  onClose: () => void;
  autoPrint?: boolean;
}

export function TerritoryProductSalesDocumentPreview({
  payload,
  open,
  onClose,
  autoPrint = false,
}: TerritoryProductSalesDocumentPreviewProps) {
  const { t, locale } = useLanguage();
  const { printDocument, downloadPdf } = useDocumentPrint();
  const dialogRef = useRef<HTMLDivElement>(null);
  const labels = buildTerritoryProductSalesDocumentLabels(t);

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
      aria-label={t("productSales.print.previewTitle")}
      tabIndex={-1}
    >
      <DocumentPrintToolbar
        title={t("productSales.print.previewTitle")}
        backLink={
          <Link
            href="/reports/product-sales-by-territory"
            className="text-sm text-slate-600 underline-offset-2 hover:underline"
          >
            {t("productSales.actions.backToReport")}
          </Link>
        }
        onPrint={printDocument}
        onDownloadPdf={downloadPdf}
        onClose={onClose}
        printLabel={t("document.actions.print")}
        downloadLabel={t("document.actions.downloadPdf")}
        closeLabel={t("common.close")}
      />
      <div className="flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-950">
        <TerritoryProductSalesDocument
          payload={payload}
          labels={labels}
          locale={locale === "bn" ? "bn" : "en"}
        />
      </div>
    </div>
  );
}
