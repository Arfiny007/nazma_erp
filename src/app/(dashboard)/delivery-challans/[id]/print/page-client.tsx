"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import {
  ChallanPrintable,
  buildChallanDocumentLabels,
  challanStatusLabel,
} from "@/components/documents/challan/challan-printable";
import { DocumentPrintToolbar } from "@/components/documents/toolbar/document-print-toolbar";
import { useDocumentPrint } from "@/lib/documents/use-document-print";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ChallanDetailLineDTO, DeliveryChallanDetailDTO } from "@/types/delivery-challan";

interface ChallanPrintPageClientProps {
  challan: DeliveryChallanDetailDTO;
  detailLines: ChallanDetailLineDTO[];
}

export function ChallanPrintPageClient({
  challan,
  detailLines,
}: ChallanPrintPageClientProps) {
  const { t, locale } = useLanguage();
  const searchParams = useSearchParams();
  const { printDocument, downloadPdf } = useDocumentPrint();

  const labels = buildChallanDocumentLabels(t);
  const statusLabel = challanStatusLabel(challan.status, t);
  const deliveryModeLabel = t(`challan.deliveryMode.${challan.deliveryMode}`);

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
          title={t("document.challan.previewTitle").replace("{challanNo}", challan.challanNo)}
          backLink={
            <Link
              href={`/delivery-challans/${challan.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t("challan.actions.backToDetail")}
            </Link>
          }
          onPrint={printDocument}
          onDownloadPdf={downloadPdf}
          printLabel={t("document.actions.print")}
          downloadLabel={t("document.actions.downloadPdf")}
        />
      </div>

      <div className="flex justify-center p-4 md:p-8">
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
  );
}
