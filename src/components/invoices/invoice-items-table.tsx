"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { hasMoneyValue } from "@/lib/utils/format-money";
import type { InvoiceDetailDTO } from "@/types/invoice";

interface InvoiceItemsTableProps {
  invoice: InvoiceDetailDTO;
  formatMoney: (value: string) => string;
  formatQuantity: (value: string, unit?: string) => string;
}

export function InvoiceItemsTable({
  invoice,
  formatMoney,
  formatQuantity,
}: InvoiceItemsTableProps) {
  const { t } = useLanguage();

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("invoice.detail.items")} ({invoice.items.length})
        </h2>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left dark:border-slate-800 dark:bg-slate-900/60">
              <th
                scope="col"
                className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                {t("invoice.detail.column.product")}
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                {t("invoice.detail.column.sku")}
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                {t("invoice.detail.column.quantity")}
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                {t("invoice.detail.column.unitPrice")}
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                {t("invoice.detail.column.discount")}
              </th>
              <th
                scope="col"
                className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                {t("invoice.detail.column.lineTotal")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {item.productName}
                  </p>
                </td>
                <td className="px-3 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {item.productCode}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                  {formatQuantity(item.quantity, item.unit)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                  {formatMoney(item.unitPrice)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">
                  {hasMoneyValue(item.discount) ? "− " : ""}
                  {formatMoney(item.discount)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                  {formatMoney(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
