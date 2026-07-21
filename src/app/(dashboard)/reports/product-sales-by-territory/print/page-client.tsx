"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import {
  TerritoryProductSalesDocument,
  buildTerritoryProductSalesDocumentLabels,
} from "@/components/documents/product-sales-territory";
import { DocumentPrintToolbar } from "@/components/documents/toolbar/document-print-toolbar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentPrint } from "@/lib/documents/use-document-print";
import type { TerritoryProductSalesPrintPayloadDTO } from "@/types/product-sales-territory";

interface ProductSalesPrintPageClientProps {
  payload: TerritoryProductSalesPrintPayloadDTO | null;
  errorKey?: string | null;
}

export function ProductSalesPrintPageClient({
  payload,
  errorKey,
}: ProductSalesPrintPageClientProps) {
  const { t, locale } = useLanguage();
  const { printDocument, downloadPdf } = useDocumentPrint();
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const labels = buildTerritoryProductSalesDocumentLabels(t);

  useEffect(() => {
    if (autoPrint && payload) {
      const timer = window.setTimeout(() => printDocument(), 400);
      return () => window.clearTimeout(timer);
    }
  }, [autoPrint, payload, printDocument]);

  if (!payload) {
    return (
      <div className="p-6 text-sm text-slate-600">
        {t(errorKey ?? "productSales.error.generic")}
        <div className="mt-3">
          <Link
            href="/reports/product-sales-by-territory"
            className="underline"
          >
            {t("productSales.actions.backToReport")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-950">
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
        printLabel={t("document.actions.print")}
        downloadLabel={t("document.actions.downloadPdf")}
      />
      <div className="flex-1 overflow-auto p-4">
        <TerritoryProductSalesDocument
          payload={payload}
          labels={labels}
          locale={locale === "bn" ? "bn" : "en"}
        />
      </div>
    </div>
  );
}
