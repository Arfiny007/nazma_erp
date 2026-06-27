"use client";

import { Loader2 } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { hasMoneyValue } from "@/lib/utils/format-money";
import type { InvoicePreviewDTO } from "@/types/invoice";

interface InvoiceFinancialSummaryProps {
  preview: InvoicePreviewDTO | null;
  loading: boolean;
  formatMoney: (value: string) => string;
}

export function InvoiceFinancialSummary({
  preview,
  loading,
  formatMoney,
}: InvoiceFinancialSummaryProps) {
  const { t } = useLanguage();

  const subtotal = preview?.subtotal ?? "0.00";
  const discount = preview?.discount ?? "0.00";
  const vat = preview?.vat ?? "0.00";
  const grandTotal = preview?.grandTotal ?? "0.00";
  const previousDue = preview?.previousDue ?? "0.00";
  const currentDue = preview?.currentDue ?? "0.00";

  return (
    <section
      aria-live="polite"
      className="sticky top-6 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("invoice.issue.financialPreview")}
        </h2>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            {t("invoice.issue.calculating")}
          </span>
        )}
      </header>

      {!preview ? (
        <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {t("invoice.issue.selectChallan")}
        </p>
      ) : (
        <dl className="divide-y divide-slate-100 dark:divide-slate-800">
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm text-slate-600 dark:text-slate-400">
              {t("invoice.summary.subtotal")}
            </dt>
            <dd className="tabular-nums text-sm font-medium text-slate-900 dark:text-slate-100">
              {formatMoney(subtotal)}
            </dd>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm text-slate-600 dark:text-slate-400">
              {t("invoice.summary.discount")}
            </dt>
            <dd className="tabular-nums text-sm font-medium text-rose-600 dark:text-rose-400">
              {hasMoneyValue(discount) ? "− " : ""}
              {formatMoney(discount)}
            </dd>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm text-slate-600 dark:text-slate-400">
              {t("invoice.summary.vat")}
            </dt>
            <dd className="tabular-nums text-sm font-medium text-slate-900 dark:text-slate-100">
              {formatMoney(vat)}
            </dd>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm text-slate-600 dark:text-slate-400">
              {t("invoice.summary.grandTotal")}
            </dt>
            <dd className="tabular-nums text-sm font-semibold text-slate-900 dark:text-slate-100">
              {formatMoney(grandTotal)}
            </dd>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm text-slate-600 dark:text-slate-400">
              {t("invoice.summary.previousDue")}
            </dt>
            <dd className="tabular-nums text-sm font-medium text-slate-900 dark:text-slate-100">
              {formatMoney(previousDue)}
            </dd>
          </div>
          <div className="flex items-center justify-between bg-slate-50/80 px-5 py-4 dark:bg-slate-800/40">
            <dt className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("invoice.summary.currentDue")}
            </dt>
            <dd className="tabular-nums text-lg font-semibold text-slate-900 dark:text-slate-50">
              {formatMoney(currentDue)}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
