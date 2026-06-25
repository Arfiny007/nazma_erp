"use client";

import { useMemo } from "react";

import { FulfillmentProgressBar } from "@/components/delivery-challans/fulfillment-progress-bar";
import { useLanguage } from "@/contexts/LanguageContext";
import { computeOrderDeliveryPercentClient } from "@/lib/delivery/quantity-client";
import type { OrderChallanLineContextDTO } from "@/types/delivery-challan";

interface ChallanFulfillmentSummaryProps {
  lines: readonly OrderChallanLineContextDTO[];
  currentQuantities: Readonly<Record<string, string>>;
}

export function ChallanFulfillmentSummary({
  lines,
  currentQuantities,
}: ChallanFulfillmentSummaryProps) {
  const { t, locale } = useLanguage();

  const formatQty = useMemo(
    () => (value: string) =>
      new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
        maximumFractionDigits: 2,
      }).format(Number(value)),
    [locale],
  );

  const summary = useMemo(() => {
    let totalOrdered = 0;
    let totalDelivered = 0;
    let totalCurrent = 0;
    let totalRemaining = 0;

    for (const line of lines) {
      const ordered = Number.parseFloat(line.orderedQuantity);
      const delivered = Number.parseFloat(line.deliveredQuantity);
      const current = Number.parseFloat(currentQuantities[line.orderItemId] ?? "0");
      const remaining = Number.parseFloat(line.remainingQuantity);

      totalOrdered += ordered;
      totalDelivered += delivered;
      totalCurrent += current;
      totalRemaining += remaining;
    }

    const afterThisDelivery = totalDelivered + totalCurrent;
    const percent = computeOrderDeliveryPercentClient(
      lines.map((line) => ({
        orderedQuantity: line.orderedQuantity,
        deliveredQuantity: (
          Number.parseFloat(line.deliveredQuantity) +
          Number.parseFloat(currentQuantities[line.orderItemId] ?? "0")
        ).toFixed(2),
      })),
    );

    return {
      totalOrdered: totalOrdered.toFixed(2),
      totalDelivered: totalDelivered.toFixed(2),
      totalCurrent: totalCurrent.toFixed(2),
      totalRemaining: totalRemaining.toFixed(2),
      afterThisDelivery: afterThisDelivery.toFixed(2),
      percent,
      hasCurrent: totalCurrent > 0,
    };
  }, [lines, currentQuantities]);

  return (
    <aside className="sticky top-6 space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("challan.fulfillment.title")}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {t("challan.fulfillment.subtitle")}
          </p>
        </header>

        <div className="space-y-4 p-5">
          <FulfillmentProgressBar
            percent={summary.percent}
            label={t("challan.fulfillment.overall")}
          />

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">
                {t("challan.fulfillment.ordered")}
              </dt>
              <dd className="tabular-nums font-medium text-slate-900 dark:text-slate-100">
                {formatQty(summary.totalOrdered)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">
                {t("challan.fulfillment.delivered")}
              </dt>
              <dd className="tabular-nums font-medium text-slate-900 dark:text-slate-100">
                {formatQty(summary.totalDelivered)}
              </dd>
            </div>
            {summary.hasCurrent && (
              <div className="flex justify-between gap-4">
                <dt className="text-sky-600 dark:text-sky-400">
                  {t("challan.fulfillment.current")}
                </dt>
                <dd className="tabular-nums font-semibold text-sky-700 dark:text-sky-300">
                  {formatQty(summary.totalCurrent)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-slate-100 pt-2 dark:border-slate-800">
              <dt className="text-slate-500 dark:text-slate-400">
                {t("challan.fulfillment.remaining")}
              </dt>
              <dd className="tabular-nums font-medium text-slate-900 dark:text-slate-100">
                {formatQty(summary.totalRemaining)}
              </dd>
            </div>
          </dl>

          {!summary.hasCurrent && (
            <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              {t("challan.fulfillment.emptyWarning")}
            </p>
          )}
        </div>
      </section>
    </aside>
  );
}
