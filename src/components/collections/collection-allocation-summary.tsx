"use client";

import { Loader2 } from "lucide-react";

import { CollectionAdvanceBanner } from "@/components/collections/collection-advance-banner";
import { useLanguage } from "@/contexts/LanguageContext";

interface CollectionAllocationSummaryProps {
  receivedAmount: string;
  allocatedAmount: string;
  unallocatedAmount: string;
  advanceCredit: string;
  dealerBalanceAfter: string | null;
  formatMoney: (value: string) => string;
  loading?: boolean;
}

export function CollectionAllocationSummary({
  receivedAmount,
  allocatedAmount,
  unallocatedAmount,
  advanceCredit,
  dealerBalanceAfter,
  formatMoney,
  loading = false,
}: CollectionAllocationSummaryProps) {
  const { t } = useLanguage();

  return (
    <section
      aria-live="polite"
      className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("collection.workspace.liveSummary")}
        </h2>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            {t("collection.workspace.calculating")}
          </span>
        )}
      </header>

      <dl className="divide-y divide-slate-100 dark:divide-slate-800">
        <SummaryRow
          label={t("collection.workspace.receivedAmount")}
          value={formatMoney(receivedAmount)}
        />
        <SummaryRow
          label={t("collection.workspace.allocatedAmount")}
          value={formatMoney(allocatedAmount)}
        />
        <SummaryRow
          label={t("collection.workspace.unallocatedAmount")}
          value={formatMoney(unallocatedAmount)}
          highlight
        />
        <SummaryRow
          label={t("collection.workspace.advanceCredit")}
          value={formatMoney(advanceCredit)}
          tone="credit"
        />
        {dealerBalanceAfter !== null && (
          <SummaryRow
            label={t("collection.workspace.dealerBalanceAfter")}
            value={formatMoney(dealerBalanceAfter)}
            highlight
          />
        )}
      </dl>

      <div className="border-t border-slate-100 p-4 dark:border-slate-800">
        <CollectionAdvanceBanner unallocatedAmount={unallocatedAmount} />
      </div>
    </section>
  );
}

interface SummaryRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "default" | "credit";
}

function SummaryRow({ label, value, highlight, tone = "default" }: SummaryRowProps) {
  return (
    <div
      className={
        highlight
          ? "flex items-center justify-between bg-slate-50/80 px-5 py-4 dark:bg-slate-800/40"
          : "flex items-center justify-between px-5 py-3"
      }
    >
      <dt
        className={
          highlight
            ? "text-sm font-semibold text-slate-900 dark:text-slate-100"
            : "text-sm text-slate-600 dark:text-slate-400"
        }
      >
        {label}
      </dt>
      <dd
        className={
          highlight
            ? "text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50"
            : tone === "credit"
              ? "text-sm font-medium tabular-nums text-blue-700 dark:text-blue-400"
              : "text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100"
        }
      >
        {value}
      </dd>
    </div>
  );
}
