"use client";

import Link from "next/link";

import { useLanguage } from "@/contexts/LanguageContext";
import type { InvoiceDetailDTO } from "@/types/invoice";

interface InvoiceMetadataCardProps {
  invoice: InvoiceDetailDTO;
  formatDate: (value: string) => string;
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

export function InvoiceMetadataCard({ invoice, formatDate }: InvoiceMetadataCardProps) {
  const { t } = useLanguage();

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("invoice.detail.metadata")}
        </h2>
      </header>
      <dl className="divide-y divide-slate-100 dark:divide-slate-800">
        <InfoRow label={t("invoice.detail.issueDate")}>
          {formatDate(invoice.issueDate)}
        </InfoRow>
        <InfoRow label={t("invoice.detail.dueDate")}>
          {formatDate(invoice.dueDate)}
        </InfoRow>
        <InfoRow label={t("invoice.detail.order")}>
          <Link
            href={`/orders/${invoice.orderId}`}
            className="font-mono text-blue-700 hover:underline dark:text-blue-400"
          >
            {invoice.orderNo}
          </Link>
        </InfoRow>
        {invoice.challanNo && invoice.deliveryChallanId && (
          <InfoRow label={t("invoice.detail.challan")}>
            <Link
              href={`/delivery-challans/${invoice.deliveryChallanId}`}
              className="font-mono text-blue-700 hover:underline dark:text-blue-400"
            >
              {invoice.challanNo}
            </Link>
          </InfoRow>
        )}
        <InfoRow label={t("invoice.detail.deliveryMode")}>
          {t(`challan.deliveryMode.${invoice.deliveryMode}`)}
        </InfoRow>
        {invoice.vehicleNo && (
          <InfoRow label={t("invoice.detail.vehicleNo")}>{invoice.vehicleNo}</InfoRow>
        )}
        {invoice.driverName && (
          <InfoRow label={t("invoice.detail.driverName")}>{invoice.driverName}</InfoRow>
        )}
      </dl>
    </section>
  );
}
