"use client";

import { ArrowLeft, Download, Printer } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import {
  InvoicePrintable,
  buildDocumentLabels,
  invoiceStatusLabel,
} from "@/components/documents/invoice/invoice-printable";
import { useDocumentPrint } from "@/lib/documents/use-document-print";
import { useLanguage } from "@/contexts/LanguageContext";
import type { InvoiceDetailDTO } from "@/types/invoice";

interface InvoicePrintPageClientProps {
  invoice: InvoiceDetailDTO;
}

export function InvoicePrintPageClient({ invoice }: InvoicePrintPageClientProps) {
  const { t, locale } = useLanguage();
  const searchParams = useSearchParams();
  const { printDocument, downloadPdf } = useDocumentPrint();

  const labels = buildDocumentLabels(t);
  const statusLabel = invoiceStatusLabel(invoice.status, t);
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
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link
          href={`/invoices/${invoice.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("invoice.actions.backToList")}
        </Link>
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
        </div>
      </div>

      <div className="flex justify-center p-4 md:p-8">
        <InvoicePrintable
          invoice={invoice}
          labels={labels}
          statusLabel={statusLabel}
          locale={locale}
        />
      </div>
    </div>
  );
}
