"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";

import { DocumentPrintToolbar } from "@/components/documents/toolbar/document-print-toolbar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentPrint } from "@/lib/documents/use-document-print";
import type { SrPerformancePrintPayloadDTO } from "@/types/sr-performance";

import { buildSrPerformanceDocumentLabels } from "./sr-performance-labels";
import { SrPerformancePrintable } from "./sr-performance-printable";

interface SrPerformanceDocumentPreviewProps {
  payload: SrPerformancePrintPayloadDTO;
  open: boolean;
  onClose: () => void;
  autoPrint?: boolean;
}

export function SrPerformanceDocumentPreview({
  payload,
  open,
  onClose,
  autoPrint = false,
}: SrPerformanceDocumentPreviewProps) {
  const { t, locale } = useLanguage();
  const { printDocument, downloadPdf } = useDocumentPrint();
  const dialogRef = useRef<HTMLDivElement>(null);
  const labels = buildSrPerformanceDocumentLabels(t);

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
      aria-label={
        payload.mode === "individual"
          ? t("srPerformance.print.individualPreviewTitle")
          : t("srPerformance.print.overviewPreviewTitle")
      }
      tabIndex={-1}
    >
      <DocumentPrintToolbar
        title={
          payload.mode === "individual"
            ? t("srPerformance.print.individualPreviewTitle")
            : t("srPerformance.print.overviewPreviewTitle")
        }
        backLink={
          <Link
            href="/reports/sr-performance"
            className="text-sm text-slate-600 underline-offset-2 hover:underline"
          >
            {t("srPerformance.actions.backToReport")}
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
        <SrPerformancePrintable
          payload={payload}
          labels={labels}
          locale={locale === "bn" ? "bn" : "en"}
        />
      </div>
    </div>
  );
}
