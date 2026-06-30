"use client";

import type { DealerFinancialSummaryDTO } from "@/types/collection";

import { AdvanceCreditIndicator } from "@/components/collections/collection-advance-banner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFormatMoney } from "@/lib/utils/use-format-money";

interface CollectionDealerSummaryCardProps {
  dealer: DealerFinancialSummaryDTO | null;
  loading?: boolean;
}

export function CollectionDealerSummaryCard({
  dealer,
  loading = false,
}: CollectionDealerSummaryCardProps) {
  const { t, locale } = useLanguage();
  const formatMoney = useFormatMoney(locale);

  const dateFormatter = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
    dateStyle: "medium",
  });

  const formatOptionalDate = (value: string | null) =>
    value ? dateFormatter.format(new Date(value)) : "—";

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("collection.workspace.dealerSummary")}
        </h2>
      </header>

      {!dealer ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {loading
            ? t("common.loading")
            : t("collection.workspace.selectDealer")}
        </p>
      ) : (
        <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4 dark:bg-slate-800">
          <SummaryCell
            label={t("collection.workspace.dealer")}
            value={`${dealer.dealerName} (${dealer.dealerCode})`}
            isText
          />
          <SummaryCell
            label={t("collection.workspace.currentBalance")}
            value={formatMoney(dealer.currentBalance)}
            highlight
            suffix={<AdvanceCreditIndicator currentBalance={dealer.currentBalance} />}
          />
          <SummaryCell
            label={t("collection.workspace.creditLimit")}
            value={formatMoney(dealer.creditLimit)}
          />
          <SummaryCell
            label={t("collection.workspace.availableCredit")}
            value={formatMoney(dealer.availableCredit)}
          />
          <SummaryCell
            label={t("collection.workspace.advanceCredit")}
            value={
              Number.parseFloat(dealer.currentBalance) < 0
                ? formatMoney(
                    Math.abs(Number.parseFloat(dealer.currentBalance)).toFixed(2),
                  )
                : formatMoney("0.00")
            }
          />
          <SummaryCell
            label={t("collection.workspace.lastCollection")}
            value={formatOptionalDate(dealer.lastCollectionDate)}
            isText
          />
          <SummaryCell
            label={t("collection.workspace.lastInvoice")}
            value={formatOptionalDate(dealer.lastInvoiceDate)}
            isText
          />
          <SummaryCell
            label={t("collection.workspace.unallocatedPool")}
            value={formatMoney(dealer.unallocatedCollectionTotal)}
          />
        </div>
      )}
    </section>
  );
}

interface SummaryCellProps {
  label: string;
  value: string;
  isText?: boolean;
  highlight?: boolean;
  suffix?: React.ReactNode;
}

function SummaryCell({ label, value, isText, highlight, suffix }: SummaryCellProps) {
  return (
    <div className="bg-white px-5 py-4 dark:bg-slate-900">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 flex flex-wrap items-center gap-2">
        <span
          className={
            isText
              ? "text-sm font-medium text-slate-900 dark:text-slate-100"
              : highlight
                ? "text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50"
                : "text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100"
          }
        >
          {value}
        </span>
        {suffix}
      </dd>
    </div>
  );
}
