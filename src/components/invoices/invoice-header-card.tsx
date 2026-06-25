"use client";

import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { useLanguage } from "@/contexts/LanguageContext";
import type { InvoiceDetailDTO } from "@/types/invoice";
import type { LucideIcon } from "lucide-react";

interface InvoiceHeaderCardProps {
  invoice: InvoiceDetailDTO;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900 dark:text-slate-100">
        {children}
      </dd>
    </div>
  );
}

export function InvoiceHeaderCard({ invoice }: InvoiceHeaderCardProps) {
  const { t } = useLanguage();

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("invoice.detail.header")}
        </h2>
      </header>
      <dl className="divide-y divide-slate-100 dark:divide-slate-800">
        <InfoRow label={t("invoice.detail.invoiceNo")}>
          <span className="font-mono text-lg text-blue-700 dark:text-blue-400">
            {invoice.invoiceNo}
          </span>
        </InfoRow>
        <InfoRow label={t("invoice.detail.status")}>
          <InvoiceStatusBadge status={invoice.status} />
        </InfoRow>
      </dl>
    </section>
  );
}

export function InvoiceCardShell({
  title,
  children,
  icon: Icon,
}: {
  title: string;
  children: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        {Icon && <Icon aria-hidden="true" className="size-4 text-slate-400" />}
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      </header>
      {children}
    </section>
  );
}
