"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import {
  SrPerformancePrintable,
  buildSrPerformanceDocumentLabels,
} from "@/components/documents/sr-performance";
import { DocumentPrintToolbar } from "@/components/documents/toolbar/document-print-toolbar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentPrint } from "@/lib/documents/use-document-print";
import type { SrPerformancePrintPayloadDTO } from "@/types/sr-performance";

interface SrPerformancePrintPageClientProps {
  payload: SrPerformancePrintPayloadDTO | null;
  errorKey?: string | null;
}

export function SrPerformancePrintPageClient({
  payload,
  errorKey,
}: SrPerformancePrintPageClientProps) {
  const { t, locale } = useLanguage();
  const { printDocument, downloadPdf } = useDocumentPrint();
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const labels = buildSrPerformanceDocumentLabels(t);

  useEffect(() => {
    if (autoPrint && payload) {
      const timer = window.setTimeout(() => printDocument(), 400);
      return () => window.clearTimeout(timer);
    }
  }, [autoPrint, payload, printDocument]);

  if (!payload) {
    return (
      <div className="p-6 text-sm text-slate-600">
        {t(errorKey ?? "srPerformance.error.generic")}
        <div className="mt-3">
          <Link href="/reports/sr-performance" className="underline">
            {t("srPerformance.actions.backToReport")}
          </Link>
        </div>
      </div>
    );
  }

  const previewTitle =
    payload.mode === "individual"
      ? t("srPerformance.print.individualPreviewTitle")
      : t("srPerformance.print.overviewPreviewTitle");

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-950">
      <DocumentPrintToolbar
        title={previewTitle}
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
        printLabel={t("document.actions.print")}
        downloadLabel={t("document.actions.downloadPdf")}
      />
      <div className="flex-1 overflow-auto p-4">
        <SrPerformancePrintable
          payload={payload}
          labels={labels}
          locale={locale === "bn" ? "bn" : "en"}
        />
      </div>
    </div>
  );
}
