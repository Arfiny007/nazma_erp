"use client";

import { useCallback, useMemo } from "react";
import type { UserRole } from "@prisma/client";

import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { InvoiceDealerCard } from "@/components/invoices/invoice-dealer-card";
import { InvoiceHeaderCard } from "@/components/invoices/invoice-header-card";
import { InvoiceHistoryTimeline } from "@/components/invoices/invoice-history-timeline";
import { InvoiceItemsTable } from "@/components/invoices/invoice-items-table";
import { InvoiceMetadataCard } from "@/components/invoices/invoice-metadata-card";
import { InvoiceTimeline } from "@/components/invoices/invoice-timeline";
import { InvoiceTotalsCard } from "@/components/invoices/invoice-totals-card";
import { useLanguage } from "@/contexts/LanguageContext";
import type { InvoiceDetailDTO } from "@/types/invoice";

interface InvoiceDetailViewProps {
  invoice: InvoiceDetailDTO;
  userRole: UserRole;
}

export function InvoiceDetailView({ invoice, userRole }: InvoiceDetailViewProps) {
  const { t, locale } = useLanguage();

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
        style: "currency",
        currency: "BDT",
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
        dateStyle: "medium",
      }),
    [locale],
  );

  const formatMoney = useCallback(
    (value: string) => currencyFormatter.format(Number(value)),
    [currencyFormatter],
  );
  const formatDate = useCallback(
    (value: string) => dateFormatter.format(new Date(value)),
    [dateFormatter],
  );
  const formatQuantity = useCallback(
    (value: string, unit?: string) => {
      const formatted = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
        maximumFractionDigits: 2,
      }).format(Number(value));
      return unit ? `${formatted} ${unit}` : formatted;
    },
    [locale],
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
      <div className="space-y-6 lg:col-span-2">
        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("invoice.timeline.title")}
          </h2>
          <InvoiceTimeline
            orderNo={invoice.orderNo}
            challanNo={invoice.challanNo}
            invoiceNo={invoice.invoiceNo}
          />
        </section>

        <InvoiceHeaderCard invoice={invoice} />
        <InvoiceMetadataCard invoice={invoice} formatDate={formatDate} />
        <InvoiceDealerCard invoice={invoice} />
        <InvoiceItemsTable
          invoice={invoice}
          formatMoney={formatMoney}
          formatQuantity={formatQuantity}
        />
        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("invoice.history.title")}
            </h2>
          </header>
          <InvoiceHistoryTimeline history={invoice.auditHistory} />
        </section>
      </div>

      <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <InvoiceTotalsCard
          subtotal={invoice.subtotal}
          discount={invoice.discount}
          vat={invoice.vat}
          grandTotal={invoice.grandTotal}
          previousDue={invoice.previousDue}
          currentDue={invoice.currentDue}
          formatMoney={formatMoney}
        />
        <InvoiceActions invoice={invoice} userRole={userRole} />
      </div>
    </div>
  );
}
