"use client";

import { useMemo } from "react";

import { FulfillmentProgressBar } from "@/components/delivery-challans/fulfillment-progress-bar";
import { useLanguage } from "@/contexts/LanguageContext";
import { isQuantityWithinAllocatable } from "@/lib/delivery/quantity-client";
import { cn } from "@/lib/utils";
import type { OrderChallanLineContextDTO } from "@/types/delivery-challan";

export interface ChallanLineInput {
  orderItemId: string;
  quantity: string;
}

interface ChallanLineEditorProps {
  lines: readonly OrderChallanLineContextDTO[];
  values: readonly ChallanLineInput[];
  onChange: (orderItemId: string, quantity: string) => void;
  fieldErrors?: Record<string, string>;
  disabled?: boolean;
}

export function ChallanLineEditor({
  lines,
  values,
  onChange,
  fieldErrors = {},
  disabled = false,
}: ChallanLineEditorProps) {
  const { t, locale } = useLanguage();

  const valueByItemId = useMemo(
    () => new Map(values.map((v) => [v.orderItemId, v.quantity])),
    [values],
  );

  const formatQty = useMemo(
    () => (value: string) =>
      new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
        maximumFractionDigits: 2,
      }).format(Number(value)),
    [locale],
  );

  if (lines.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        {t("challan.form.lines.empty")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
        <thead>
          <tr className="bg-slate-50/80 dark:bg-slate-800/40">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("challan.form.lines.product")}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("challan.form.lines.ordered")}
            </th>
            <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell dark:text-slate-400">
              {t("challan.form.lines.delivered")}
            </th>
            <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell dark:text-slate-400">
              {t("challan.form.lines.remaining")}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("challan.form.lines.challanQty")}
            </th>
            <th className="hidden min-w-[140px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell dark:text-slate-400">
              {t("challan.form.lines.progress")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {lines.map((line) => {
            const currentQty = valueByItemId.get(line.orderItemId) ?? "";
            const allocatable = line.allocatableQuantity;
            const hasAllocatable = Number.parseFloat(allocatable) > 0;
            const isOver =
              currentQty !== "" &&
              !isQuantityWithinAllocatable(currentQty, allocatable) &&
              Number.parseFloat(currentQty) > 0;
            const fieldError = fieldErrors[line.orderItemId];
            const projectedDelivered = (
              Number.parseFloat(line.deliveredQuantity) +
              Number.parseFloat(currentQty || "0")
            ).toFixed(2);
            const projectedPercent =
              Number.parseFloat(line.orderedQuantity) > 0
                ? (
                    (Number.parseFloat(projectedDelivered) /
                      Number.parseFloat(line.orderedQuantity)) *
                    100
                  ).toFixed(0)
                : "0";

            return (
              <tr
                key={line.orderItemId}
                className={cn(
                  !hasAllocatable && "opacity-50",
                  isOver && "bg-rose-50/50 dark:bg-rose-950/20",
                )}
              >
                <td className="px-4 py-3">
                  <div className="min-w-[160px]">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {line.productName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {line.productSku}
                      {line.productModelNumber ? ` · ${line.productModelNumber}` : ""}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700 dark:text-slate-300">
                  {formatQty(line.orderedQuantity)} {line.unit}
                </td>
                <td className="hidden px-4 py-3 text-right text-sm tabular-nums text-slate-700 sm:table-cell dark:text-slate-300">
                  {formatQty(line.deliveredQuantity)}
                </td>
                <td className="hidden px-4 py-3 text-right text-sm tabular-nums text-slate-700 md:table-cell dark:text-slate-300">
                  {formatQty(line.remainingQuantity)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-end gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={disabled || !hasAllocatable}
                      value={currentQty}
                      onChange={(event) =>
                        onChange(line.orderItemId, event.target.value)
                      }
                      placeholder="0"
                      aria-invalid={isOver || Boolean(fieldError)}
                      aria-describedby={
                        isOver ? `qty-error-${line.orderItemId}` : undefined
                      }
                      className={cn(
                        "w-24 rounded-lg border bg-white px-2.5 py-1.5 text-right text-sm tabular-nums shadow-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 dark:bg-slate-950",
                        isOver || fieldError
                          ? "border-rose-400 focus:ring-rose-500/20"
                          : "border-slate-300 focus:border-slate-400 focus:ring-slate-900/10 dark:border-slate-700",
                      )}
                    />
                    <span className="text-[10px] text-slate-400">
                      {t("challan.form.lines.max")} {formatQty(allocatable)}
                    </span>
                    {(isOver || fieldError) && (
                      <span
                        id={`qty-error-${line.orderItemId}`}
                        role="alert"
                        className="max-w-[120px] text-right text-[10px] font-medium text-rose-600 dark:text-rose-400"
                      >
                        {fieldError ? t(fieldError) : t("challan.error.overDelivery")}
                      </span>
                    )}
                  </div>
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <FulfillmentProgressBar
                    percent={projectedPercent}
                    size="sm"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
