"use client";

import { Download, Eye, Printer, Receipt } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { UserRole } from "@prisma/client";

import { InvoiceDocumentPreview } from "@/components/documents/invoice/invoice-document-preview";
import { IssueInvoiceDialog } from "@/components/invoices/issue-invoice-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { hasPermission } from "@/lib/permissions";
import type { DeliveryChallanDetailDTO } from "@/types/delivery-challan";
import type { InvoiceDetailDTO } from "@/types/invoice";

interface InvoiceActionsProps {
  challan?: DeliveryChallanDetailDTO;
  invoice?: InvoiceDetailDTO;
  userRole: UserRole;
}

export function InvoiceActions({ challan, invoice, userRole }: InvoiceActionsProps) {
  const { t } = useLanguage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const canIssue = hasPermission(userRole, "invoices:create");

  if (challan) {
    const showIssue =
      canIssue && challan.status === "Confirmed" && !challan.hasInvoice;

    if (!showIssue) return null;

    return (
      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("invoice.actions.title")}
          </h2>
        </header>
        <div className="space-y-3 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("invoice.actions.issueDescription")}
          </p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Receipt aria-hidden="true" className="size-4" />
            {t("invoice.actions.issue")}
          </button>
          <Link
            href="/invoices/issue"
            className="block text-center text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
          >
            {t("invoice.actions.openIssuePage")}
          </Link>
        </div>
        <IssueInvoiceDialog
          challanId={challan.id}
          challanNo={challan.challanNo}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
      </section>
    );
  }

  if (invoice) {
    return (
      <>
        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("document.invoice.actionsTitle")}
            </h2>
          </header>
          <div className="space-y-2 p-5">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Eye aria-hidden="true" className="size-4" />
              {t("document.actions.preview")}
            </button>
            <Link
              href={`/invoices/${invoice.id}/print`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Printer aria-hidden="true" className="size-4" />
              {t("document.actions.print")}
            </Link>
            <Link
              href={`/invoices/${invoice.id}/print?download=1`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Download aria-hidden="true" className="size-4" />
              {t("document.actions.downloadPdf")}
            </Link>
          </div>
        </section>
        <InvoiceDocumentPreview
          invoice={invoice}
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
        />
      </>
    );
  }

  return null;
}
