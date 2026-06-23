"use client";

import { useCallback, useMemo } from "react";
import type { UserRole } from "@prisma/client";

import { ApprovalActions } from "@/components/orders/approval-actions";
import { OrderHistoryTimeline } from "@/components/orders/order-history-timeline";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { useLanguage } from "@/contexts/LanguageContext";
import type { OrderDetailDTO } from "@/types/order";

interface OrderDetailViewProps {
  order: OrderDetailDTO;
  userRole: UserRole;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900 dark:text-slate-100">
        {children}
      </dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

export function OrderDetailView({ order, userRole }: OrderDetailViewProps) {
  const { t, locale } = useLanguage();

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
        style: "currency",
        currency: "BDT",
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const formatMoney = useCallback(
    (value: string) => currencyFormatter.format(Number(value)),
    [currencyFormatter],
  );
  const formatDateTime = useCallback(
    (value: string) => dateTimeFormatter.format(new Date(value)),
    [dateTimeFormatter],
  );
  const formatQuantity = useCallback(
    (value: string) =>
      new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
        maximumFractionDigits: 2,
      }).format(Number(value)),
    [locale],
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
      <div className="space-y-6 lg:col-span-2">
        {/* Order Information */}
        <Card title={t("order.detail.information")}>
          <dl className="divide-y divide-slate-100 dark:divide-slate-800">
            <InfoRow label={t("order.detail.orderNo")}>
              <span className="font-mono text-blue-700 dark:text-blue-400">
                {order.orderNo}
              </span>
            </InfoRow>
            <InfoRow label={t("order.detail.status")}>
              <OrderStatusBadge status={order.status} />
            </InfoRow>
            <InfoRow label={t("order.detail.invoiceCount")}>
              <span className="tabular-nums">{order.invoiceCount}</span>
            </InfoRow>
          </dl>
        </Card>

        {/* Items */}
        <Card title={`${t("order.detail.items")} (${order.itemCount})`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left dark:border-slate-800 dark:bg-slate-900/60">
                  <th scope="col" className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t("order.form.items.product")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t("order.form.items.sku")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t("order.form.items.quantity")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t("order.form.items.unitPrice")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t("order.column.discount")}
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t("order.form.items.lineTotal")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {item.productName}
                      </p>
                      <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {item.productModelNumber}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {item.productSku}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {formatQuantity(item.quantity)} {item.unit}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {formatMoney(item.unitPrice)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {formatMoney(item.discount)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {formatMoney(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Financial Summary */}
        <Card title={t("order.detail.financialSummary")}>
          <dl className="divide-y divide-slate-100 dark:divide-slate-800">
            <InfoRow label={t("order.summary.subtotal")}>
              <span className="tabular-nums">{formatMoney(order.subtotal)}</span>
            </InfoRow>
            <InfoRow label={t("order.summary.discountAmount")}>
              <span className="tabular-nums text-rose-600 dark:text-rose-400">
                {Number(order.discount) > 0 ? "− " : ""}
                {formatMoney(order.discount)}
              </span>
            </InfoRow>
            <div className="flex items-center justify-between bg-slate-50/80 px-5 py-4 dark:bg-slate-800/40">
              <dt className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("order.summary.grandTotal")}
              </dt>
              <dd className="tabular-nums text-lg font-semibold text-slate-900 dark:text-slate-50">
                {formatMoney(order.grandTotal)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="space-y-6">
        <ApprovalActions order={order} userRole={userRole} />

        {/* Dealer */}
        <Card title={t("order.detail.dealer")}>
          <dl className="divide-y divide-slate-100 dark:divide-slate-800">
            <InfoRow label={t("order.detail.dealerCode")}>
              <span className="font-mono text-xs">{order.dealer.dealerCode}</span>
            </InfoRow>
            <InfoRow label={t("order.detail.dealerName")}>
              {order.dealer.companyName}
            </InfoRow>
          </dl>
        </Card>

        {/* Project */}
        <Card title={t("order.detail.project")}>
          {order.project ? (
            <dl className="divide-y divide-slate-100 dark:divide-slate-800">
              <InfoRow label={t("order.detail.projectCode")}>
                <span className="font-mono text-xs">{order.project.projectCode}</span>
              </InfoRow>
              <InfoRow label={t("order.detail.projectName")}>
                {order.project.name}
              </InfoRow>
            </dl>
          ) : (
            <p className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
              {t("order.detail.noProject")}
            </p>
          )}
        </Card>

        {/* Audit / Approval information */}
        <Card title={t("order.history.title")}>
          <dl className="divide-y divide-slate-100 dark:divide-slate-800">
            <InfoRow label={t("order.detail.createdBy")}>
              {order.createdBy?.name ?? t("order.unknownUser")}
            </InfoRow>
            <InfoRow label={t("order.detail.createdAt")}>
              <span className="tabular-nums">{formatDateTime(order.createdAt)}</span>
            </InfoRow>
            <InfoRow label={t("order.detail.updatedAt")}>
              <span className="tabular-nums">{formatDateTime(order.updatedAt)}</span>
            </InfoRow>
            <InfoRow label={t("order.detail.approvedBy")}>
              {order.approvedBy ? (
                order.approvedBy.name
              ) : (
                <span className="text-slate-400 dark:text-slate-500">
                  {t("order.detail.notApproved")}
                </span>
              )}
            </InfoRow>
            {order.approvedAt && (
              <InfoRow label={t("order.detail.approvedAt")}>
                <span className="tabular-nums">{formatDateTime(order.approvedAt)}</span>
              </InfoRow>
            )}
          </dl>
          <div className="border-t border-slate-100 dark:border-slate-800/80">
            <OrderHistoryTimeline history={order.approvalHistory} />
          </div>
        </Card>
      </div>
    </div>
  );
}
