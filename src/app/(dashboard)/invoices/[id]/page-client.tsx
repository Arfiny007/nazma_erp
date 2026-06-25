"use client";

import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { UserRole } from "@prisma/client";

import { InvoiceDetailView } from "@/components/invoices/invoice-detail-view";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";
import type { InvoiceDetailDTO } from "@/types/invoice";

interface InvoiceDetailPageClientProps {
  invoice: InvoiceDetailDTO | null;
}

export function InvoiceDetailPageClient({ invoice }: InvoiceDetailPageClientProps) {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;

  if (!invoice) {
    return (
      <PageContainer title={t("invoice.detail.loadError")}>
        <div className="flex flex-col items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/50 px-6 py-16 text-center dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/60">
            <AlertCircle aria-hidden="true" className="size-5 text-rose-500 dark:text-rose-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {t("invoice.detail.loadError")}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {t("invoice.detail.loadErrorDescription")}
          </p>
          <Link
            href="/invoices"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t("invoice.actions.backToList")}
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={t("invoice.detail.title").replace("{invoiceNo}", invoice.invoiceNo)}
      description={t("invoice.detail.subtitle")}
      actions={
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("invoice.actions.backToList")}
        </Link>
      }
    >
      {userRole && <InvoiceDetailView invoice={invoice} userRole={userRole} />}
    </PageContainer>
  );
}
