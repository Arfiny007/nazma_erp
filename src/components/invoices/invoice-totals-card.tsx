"use client";

import { useLanguage } from "@/contexts/LanguageContext";

interface InvoiceTotalsCardProps {
  subtotal: string;
  discount: string;
  vat: string;
  grandTotal: string;
  previousDue: string;
  currentDue: string;
  formatMoney: (value: string) => string;
}

function SummaryRow({
  label,
  value,
  emphasis,
  negative,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-5 py-3 ${
        emphasis ? "bg-slate-50/80 dark:bg-slate-800/40" : ""
      }`}
    >
      <dt
        className={`text-sm ${
          emphasis
            ? "font-semibold text-slate-900 dark:text-slate-100"
            : "text-slate-600 dark:text-slate-400"
        }`}
      >
        {label}
      </dt>
      <dd
        className={`tabular-nums text-sm ${
          emphasis
            ? "text-lg font-semibold text-slate-900 dark:text-slate-50"
            : negative
              ? "font-medium text-rose-600 dark:text-rose-400"
              : "font-medium text-slate-900 dark:text-slate-100"
        }`}
      >
        {negative && "− "}
        {value}
      </dd>
    </div>
  );
}

export function InvoiceTotalsCard({
  subtotal,
  discount,
  vat,
  grandTotal,
  previousDue,
  currentDue,
  formatMoney,
}: InvoiceTotalsCardProps) {
  const { t } = useLanguage();

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("invoice.detail.financialSummary")}
        </h2>
      </header>
      <dl className="divide-y divide-slate-100 dark:divide-slate-800">
        <SummaryRow label={t("invoice.summary.subtotal")} value={formatMoney(subtotal)} />
        <SummaryRow
          label={t("invoice.summary.discount")}
          value={formatMoney(discount)}
          negative={Number(discount) > 0}
        />
        <SummaryRow label={t("invoice.summary.vat")} value={formatMoney(vat)} />
        <SummaryRow
          label={t("invoice.summary.grandTotal")}
          value={formatMoney(grandTotal)}
          emphasis
        />
        <SummaryRow
          label={t("invoice.summary.previousDue")}
          value={formatMoney(previousDue)}
        />
        <SummaryRow
          label={t("invoice.summary.currentDue")}
          value={formatMoney(currentDue)}
          emphasis
        />
      </dl>
    </section>
  );
}
