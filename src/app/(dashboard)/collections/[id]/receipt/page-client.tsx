"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

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

interface MoneyReceiptPrintPageClientProps {
  document: MoneyReceiptDocumentDTO;
  collectionId: string;
}

export function MoneyReceiptPrintPageClient({
  document,
  collectionId,
}: MoneyReceiptPrintPageClientProps) {
  const { t, locale } = useLanguage();
  const searchParams = useSearchParams();
  const { printDocument, downloadPdf } = useDocumentPrint();

  const labels = buildMoneyReceiptLabels(t);
  const statusLabel = collectionStatusLabel(document.status, t);
  const paymentMethodLabel = collectionPaymentMethodLabel(document.paymentMethod, t);
  const referenceTypeLabel = useMemo(
    () => (type: string) => financialReferenceTypeLabel(type, t),
    [t],
  );

  const autoPrint = searchParams.get("print") === "1";
  const autoDownload = searchParams.get("download") === "1";

  useEffect(() => {
    if (autoPrint || autoDownload) {
      const timer = window.setTimeout(() => {
        if (autoDownload) {
          downloadPdf();
        } else {
          printDocument();
        }
      }, 500);
      return () => window.clearTimeout(timer);
    }
  }, [autoPrint, autoDownload, printDocument, downloadPdf]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="no-print sticky top-0 z-10">
        <DocumentPrintToolbar
          title={labels.previewTitle.replace("{collectionNo}", document.collectionNo)}
          backLink={
            <Link
              href={`/collections/${collectionId}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t("collection.actions.backToDetail")}
            </Link>
          }
          onPrint={printDocument}
          onDownloadPdf={downloadPdf}
          printLabel={t("document.actions.print")}
          downloadLabel={t("document.actions.downloadPdf")}
        />
      </div>

      <div className="flex justify-center p-4 md:p-8">
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
  );
}
