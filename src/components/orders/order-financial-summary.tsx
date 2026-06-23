"use client";

import { Loader2 } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { OrderTotalsPreviewDTO } from "@/types/order";

interface OrderFinancialSummaryProps {
  discountPercent: string;
  onDiscountPercentChange: (value: string) => void;
  preview: OrderTotalsPreviewDTO | null;
  loading: boolean;
  disabled?: boolean;
  hasItems: boolean;
  formatMoney: (value: string) => string;
}

/** Removes everything except digits and a single decimal point (max 2 dp). */
function sanitizePercent(value: string): string {
  let cleaned = value.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot !== -1) {
    cleaned = cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
  }
  const [intPart, decPart] = cleaned.split(".");
  let normalizedInt = intPart.replace(/^0+(?=\d)/, "");
  if (Number(normalizedInt) > 100) {
    normalizedInt = "100";
  }
  if (decPart === undefined) {
    return normalizedInt;
  }
  return `${normalizedInt === "" ? "0" : normalizedInt}.${decPart.slice(0, 2)}`;
}

export function OrderFinancialSummary({
  discountPercent,
  onDiscountPercentChange,
  preview,
  loading,
  disabled,
  hasItems,
  formatMoney,
}: OrderFinancialSummaryProps) {
  const { t } = useLanguage();

  const subtotal = preview?.subtotal ?? "0.00";
  const discountAmount = preview?.discountAmount ?? "0.00";
  const grandTotal = preview?.grandTotal ?? "0.00";

  return (
    <section
      aria-live="polite"
      className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("order.summary.title")}
        </h2>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            {t("order.summary.calculating")}
          </span>
        )}
      </header>

      {!hasItems ? (
        <p className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {t("order.summary.empty")}
        </p>
      ) : (
        <dl className="divide-y divide-slate-100 dark:divide-slate-800">
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm text-slate-600 dark:text-slate-400">
              {t("order.summary.subtotal")}
            </dt>
            <dd className="tabular-nums text-sm font-medium text-slate-900 dark:text-slate-100">
              {formatMoney(subtotal)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <dt className="text-sm text-slate-600 dark:text-slate-400">
              {t("order.summary.discountPercent")}
            </dt>
            <dd className="flex items-center">
              <div
                className={cn(
                  "flex items-center overflow-hidden rounded-lg border bg-white shadow-sm focus-within:ring-2 dark:bg-slate-950",
                  "border-slate-300 focus-within:border-slate-400 focus-within:ring-slate-900/10 dark:border-slate-700 dark:focus-within:border-slate-600 dark:focus-within:ring-white/10",
                  disabled && "opacity-60",
                )}
              >
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  disabled={disabled}
                  aria-label={t("order.summary.discountPercent")}
                  value={discountPercent}
                  placeholder={t("order.summary.discountPercentPlaceholder")}
                  onChange={(event) =>
                    onDiscountPercentChange(sanitizePercent(event.target.value))
                  }
                  className="w-20 bg-transparent px-3 py-1.5 text-right text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                />
                <span className="select-none border-l border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  %
                </span>
              </div>
            </dd>
          </div>

          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm text-slate-600 dark:text-slate-400">
              {t("order.summary.discountAmount")}
            </dt>
            <dd className="tabular-nums text-sm font-medium text-rose-600 dark:text-rose-400">
              {Number(discountAmount) > 0 ? "− " : ""}
              {formatMoney(discountAmount)}
            </dd>
          </div>

          <div className="flex items-center justify-between bg-slate-50/80 px-5 py-4 dark:bg-slate-800/40">
            <dt className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("order.summary.grandTotal")}
            </dt>
            <dd className="tabular-nums text-lg font-semibold text-slate-900 dark:text-slate-50">
              {formatMoney(grandTotal)}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
