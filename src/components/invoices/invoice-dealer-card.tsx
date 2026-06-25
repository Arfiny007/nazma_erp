"use client";

import Link from "next/link";

import { useLanguage } from "@/contexts/LanguageContext";
import type { InvoiceDetailDTO } from "@/types/invoice";

interface InvoiceDealerCardProps {
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

export function InvoiceDealerCard({ invoice }: InvoiceDealerCardProps) {
  const { t } = useLanguage();

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("invoice.detail.dealer")}
        </h2>
      </header>
      <dl className="divide-y divide-slate-100 dark:divide-slate-800">
        <InfoRow label={t("invoice.detail.dealerCode")}>
          <Link
            href={`/dealers/${invoice.dealerCode}`}
            className="font-mono text-blue-700 hover:underline dark:text-blue-400"
          >
            {invoice.dealerCode}
          </Link>
        </InfoRow>
        <InfoRow label={t("invoice.detail.dealerName")}>{invoice.dealerName}</InfoRow>
      </dl>
    </section>
  );
}
