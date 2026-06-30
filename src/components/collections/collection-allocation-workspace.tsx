"use client";

import Link from "next/link";
import { useId } from "react";

import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { OutstandingInvoiceDTO } from "@/types/collection";

export type AllocationInputMap = Record<string, string>;

interface CollectionAllocationWorkspaceProps {
  invoices: OutstandingInvoiceDTO[];
  allocations: AllocationInputMap;
  disabled?: boolean;
  loading?: boolean;
  formatMoney: (value: string) => string;
  formatDate: (value: string) => string;
  onAllocationChange: (invoiceId: string, value: string) => void;
}

export function CollectionAllocationWorkspace({
  invoices,
  allocations,
  disabled = false,
  loading = false,
  formatMoney,
  formatDate,
  onAllocationChange,
}: CollectionAllocationWorkspaceProps) {
  const { t } = useLanguage();
  const tableId = useId();

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("collection.workspace.allocationWorkspace")}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {t("collection.workspace.allocationWorkspaceHint")}
        </p>
      </header>

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {t("common.loading")}
        </p>
      ) : invoices.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {t("collection.workspace.noOutstandingInvoices")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm" id={tableId}>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("collection.workspace.column.invoice")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("collection.workspace.column.issueDate")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("collection.workspace.column.dueDate")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("collection.workspace.column.outstanding")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("collection.workspace.column.allocate")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("collection.workspace.column.remaining")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoices.map((invoice) => {
                const allocated = allocations[invoice.id] ?? "";
                const allocatedNum = Number.parseFloat(allocated) || 0;
                const outstandingNum = Number.parseFloat(invoice.allocatableOutstanding);
                const remaining = Math.max(outstandingNum - allocatedNum, 0).toFixed(2);
                const isPaid = outstandingNum <= 0;

                return (
                  <tr
                    key={invoice.id}
                    className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="font-mono text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
                        >
                          {invoice.invoiceNo}
                        </Link>
                        <InvoiceStatusBadge status={invoice.status} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatDate(invoice.issueDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {formatMoney(invoice.allocatableOutstanding)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={allocated}
                        disabled={disabled || isPaid}
                        onChange={(event) =>
                          onAllocationChange(invoice.id, event.target.value)
                        }
                        placeholder="0.00"
                        aria-label={`${t("collection.workspace.column.allocate")} ${invoice.invoiceNo}`}
                        className={cn(
                          "w-28 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-right text-sm tabular-nums shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800/50",
                        )}
                      />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {formatMoney(remaining)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Sums allocation input strings for UI display only (not financial posting). */
export function sumAllocationInputs(allocations: AllocationInputMap): string {
  let total = 0;
  for (const value of Object.values(allocations)) {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed) && parsed > 0) {
      total += parsed;
    }
  }
  return total.toFixed(2);
}

export function buildAllocationLines(
  allocations: AllocationInputMap,
): Array<{ referenceId: string; allocatedAmount: string; allocationOrder: number }> {
  return Object.entries(allocations)
    .filter(([, amount]) => {
      const parsed = Number.parseFloat(amount);
      return !Number.isNaN(parsed) && parsed > 0;
    })
    .map(([referenceId, allocatedAmount], index) => ({
      referenceId,
      allocatedAmount,
      allocationOrder: index,
    }));
}
