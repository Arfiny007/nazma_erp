"use client";

import { Download, Eye, Printer } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { MoneyReceiptDocumentPreview } from "@/components/documents/money-receipt/money-receipt-document-preview";
import { mapCollectionToReceiptDocument } from "@/lib/documents/map-collection-receipt";
import { useLanguage } from "@/contexts/LanguageContext";
import { canPrintMoneyReceipt } from "@/lib/collections/workflow";
import type { CollectionDetailDTO } from "@/types/collection";

interface CollectionDocumentActionsProps {
  collection: CollectionDetailDTO;
}

export function CollectionDocumentActions({ collection }: CollectionDocumentActionsProps) {
  const { t } = useLanguage();
  const [previewOpen, setPreviewOpen] = useState(false);

  const printable = canPrintMoneyReceipt(collection.status);

  const receiptDocument = useMemo(() => {
    if (!printable) return null;
    return mapCollectionToReceiptDocument(collection);
  }, [collection, printable]);

  if (!printable || !receiptDocument) {
    return null;
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("document.receipt.actionsTitle")}
          </h2>
        </header>
        <div className="space-y-2 p-5">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Eye aria-hidden="true" className="size-4" />
            {t("document.actions.previewReceipt")}
          </button>
          <Link
            href={`/collections/${collection.id}/receipt`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Printer aria-hidden="true" className="size-4" />
            {t("document.actions.print")}
          </Link>
          <Link
            href={`/collections/${collection.id}/receipt?download=1`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Download aria-hidden="true" className="size-4" />
            {t("document.actions.downloadPdf")}
          </Link>
        </div>
      </section>
      <MoneyReceiptDocumentPreview
        document={receiptDocument}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
