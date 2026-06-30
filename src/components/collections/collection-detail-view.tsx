"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { UserRole } from "@prisma/client";

import { CollectionAdvanceBanner } from "@/components/collections/collection-advance-banner";
import { CollectionHistoryTimeline } from "@/components/collections/collection-history-timeline";
import {
  canAllocateCollection,
  canReverseCollection,
  CollectionReverseDialog,
} from "@/components/collections/collection-reverse-dialog";
import { CollectionStatusBadge } from "@/components/collections/collection-status-badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { hasPermission } from "@/lib/permissions";
import { useFormatMoney } from "@/lib/utils/use-format-money";
import type { CollectionDetailDTO } from "@/types/collection";

interface CollectionDetailViewProps {
  collection: CollectionDetailDTO;
  userRole: UserRole;
  openReverseOnMount?: boolean;
  onRefresh?: () => void;
}

export function CollectionDetailView({
  collection,
  userRole,
  openReverseOnMount = false,
  onRefresh,
}: CollectionDetailViewProps) {
  const { t, locale } = useLanguage();
  const formatMoney = useFormatMoney(locale);
  const [reverseOpen, setReverseOpen] = useState(openReverseOnMount);

  const canEdit = hasPermission(userRole, "collections:edit");

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const formatDate = useCallback(
    (value: string) => dateFormatter.format(new Date(value)),
    [dateFormatter],
  );

  const showAllocate =
    canEdit && canAllocateCollection(collection.status, collection.unallocatedAmount);
  const showReverse = canEdit && canReverseCollection(collection.status);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          <CollectionAdvanceBanner unallocatedAmount={collection.unallocatedAmount} />

          <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t("collection.detail.header")}
                </p>
                <h2 className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {collection.collectionNo}
                </h2>
              </div>
              <CollectionStatusBadge status={collection.status} />
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailField
                label={t("collection.detail.dealer")}
                value={`${collection.dealerName} (${collection.dealerCode})`}
              />
              <DetailField
                label={t("collection.detail.collectionDate")}
                value={formatDate(collection.collectionDate)}
              />
              <DetailField
                label={t("collection.detail.paymentMethod")}
                value={t(`collection.paymentMethod.${collection.paymentMethod}`)}
              />
              <DetailField
                label={t("collection.detail.referenceNo")}
                value={collection.referenceNumber ?? "—"}
              />
              <DetailField
                label={t("collection.detail.bankName")}
                value={collection.bankName ?? "—"}
              />
              <DetailField
                label={t("collection.detail.remarks")}
                value={collection.remarks ?? "—"}
              />
            </dl>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("collection.detail.allocationHistory")}
              </h2>
            </header>
            {collection.allocations.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
                {t("collection.detail.noAllocations")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        {t("collection.detail.column.reference")}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        {t("collection.detail.column.amount")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        {t("collection.detail.column.date")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {collection.allocations.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3">
                          {row.referenceLabel ? (
                            <Link
                              href={`/invoices/${row.referenceId}`}
                              className="font-mono text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
                            >
                              {row.referenceLabel}
                            </Link>
                          ) : (
                            row.referenceId
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {formatMoney(row.allocatedAmount)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {formatDate(row.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("collection.history.title")}
              </h2>
            </header>
            <CollectionHistoryTimeline history={collection.auditHistory} />
          </section>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("collection.detail.financialSummary")}
              </h2>
            </header>
            <dl className="divide-y divide-slate-100 dark:divide-slate-800">
              <FinancialRow
                label={t("collection.workspace.receivedAmount")}
                value={formatMoney(collection.receivedAmount)}
              />
              <FinancialRow
                label={t("collection.workspace.allocatedAmount")}
                value={formatMoney(collection.allocatedAmount)}
              />
              <FinancialRow
                label={t("collection.workspace.unallocatedAmount")}
                value={formatMoney(collection.unallocatedAmount)}
                highlight
              />
              {collection.reversedAt && (
                <FinancialRow
                  label={t("collection.detail.reversedAt")}
                  value={formatDate(collection.reversedAt)}
                  isText
                />
              )}
              {collection.reversalReason && (
                <FinancialRow
                  label={t("collection.detail.reversalReason")}
                  value={collection.reversalReason}
                  isText
                />
              )}
            </dl>
          </section>

          {(showAllocate || showReverse) && (
            <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t("collection.actions.title")}
                </h2>
              </header>
              <div className="space-y-2 p-5">
                {showAllocate && (
                  <Link
                    href={`/collections/${collection.id}/allocate`}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 dark:bg-white dark:text-slate-900"
                  >
                    {t("collection.actions.allocate")}
                  </Link>
                )}
                {showReverse && (
                  <button
                    type="button"
                    onClick={() => setReverseOpen(true)}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-400"
                  >
                    {t("collection.actions.reverse")}
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      <CollectionReverseDialog
        collectionId={collection.id}
        collectionNo={collection.collectionNo}
        userRole={userRole}
        open={reverseOpen}
        onClose={() => setReverseOpen(false)}
        onReversed={() => {
          onRefresh?.();
          window.location.reload();
        }}
      />
    </>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}

function FinancialRow({
  label,
  value,
  highlight,
  isText,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  isText?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "flex items-center justify-between bg-slate-50/80 px-5 py-4 dark:bg-slate-800/40"
          : "flex items-center justify-between px-5 py-3"
      }
    >
      <dt className="text-sm text-slate-600 dark:text-slate-400">{label}</dt>
      <dd
        className={
          highlight
            ? "text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50"
            : isText
              ? "text-sm font-medium text-slate-900 dark:text-slate-100"
              : "text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100"
        }
      >
        {value}
      </dd>
    </div>
  );
}
