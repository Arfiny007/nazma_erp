"use client";

import { useCallback, useMemo } from "react";
import type { OrderStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { Printer } from "lucide-react";

import { ChallanHistoryTimeline } from "@/components/delivery-challans/challan-history-timeline";
import { ChallanStatusBadge } from "@/components/delivery-challans/challan-status-badge";
import { ChallanWorkflowActions } from "@/components/delivery-challans/challan-workflow-actions";
import { FulfillmentProgressBar } from "@/components/delivery-challans/fulfillment-progress-bar";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { computeOrderDeliveryPercentClient } from "@/lib/delivery/quantity-client";
import type {
  ChallanDetailLineDTO,
  DeliveryChallanDetailDTO,
  OrderFulfillmentProgressDTO,
} from "@/types/delivery-challan";

interface ChallanDetailViewProps {
  challan: DeliveryChallanDetailDTO;
  detailLines: ChallanDetailLineDTO[];
  fulfillment: OrderFulfillmentProgressDTO | null;
  orderStatus: OrderStatus | null;
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

function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className ?? ""}`}
    >
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function ChallanDetailView({
  challan,
  detailLines,
  fulfillment,
  orderStatus,
  userRole,
}: ChallanDetailViewProps) {
  const { t, locale } = useLanguage();

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const formatQty = useCallback(
    (value: string, unit?: string) => {
      const formatted = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
        maximumFractionDigits: 2,
      }).format(Number(value));
      return unit ? `${formatted} ${unit}` : formatted;
    },
    [locale],
  );

  const orderPercent = useMemo(() => {
    if (fulfillment?.lines.length) {
      return computeOrderDeliveryPercentClient(fulfillment.lines);
    }
    return computeOrderDeliveryPercentClient(
      detailLines.map((line) => ({
        orderedQuantity: line.orderedQuantity,
        deliveredQuantity: line.deliveredPreviously,
      })),
    );
  }, [fulfillment, detailLines]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="challan-print-area grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
      <div className="space-y-6 lg:col-span-2">
        <Card title={t("challan.detail.information")}>
          <dl className="divide-y divide-slate-100 dark:divide-slate-800">
            <InfoRow label={t("challan.detail.challanNo")}>
              <span className="font-mono text-blue-700 dark:text-blue-400">
                {challan.challanNo}
              </span>
            </InfoRow>
            <InfoRow label={t("challan.detail.status")}>
              <ChallanStatusBadge status={challan.status} />
            </InfoRow>
            <InfoRow label={t("challan.detail.order")}>
              <Link
                href={`/orders/${challan.orderId}`}
                className="font-mono text-blue-700 hover:underline dark:text-blue-400"
              >
                {challan.orderNo}
              </Link>
            </InfoRow>
            <InfoRow label={t("challan.detail.dealer")}>
              <span>
                {challan.dealerCode} · {challan.dealerName}
              </span>
            </InfoRow>
            <InfoRow label={t("challan.detail.deliveryMode")}>
              {t(`challan.deliveryMode.${challan.deliveryMode}`)}
            </InfoRow>
            <InfoRow label={t("challan.detail.vehicleNo")}>
              {challan.vehicleNo ?? t("challan.notSet")}
            </InfoRow>
            <InfoRow label={t("challan.detail.driverName")}>
              {challan.driverName ?? t("challan.notSet")}
            </InfoRow>
            {challan.remarks && (
              <InfoRow label={t("challan.detail.remarks")}>
                <span className="max-w-xs text-left">{challan.remarks}</span>
              </InfoRow>
            )}
            <InfoRow label={t("challan.detail.dispatchedAt")}>
              {challan.dispatchedAt
                ? dateTimeFormatter.format(new Date(challan.dispatchedAt))
                : t("challan.notDispatched")}
            </InfoRow>
            <InfoRow label={t("challan.detail.createdAt")}>
              {dateTimeFormatter.format(new Date(challan.createdAt))}
            </InfoRow>
            <InfoRow label={t("challan.detail.createdBy")}>
              {challan.createdByName ?? t("order.unknownUser")}
            </InfoRow>
            {challan.confirmedByName && (
              <InfoRow label={t("challan.detail.confirmedBy")}>
                {challan.confirmedByName}
              </InfoRow>
            )}
          </dl>
        </Card>

        <Card title={t("challan.detail.items")} className="print:break-inside-avoid">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t("challan.detail.column.product")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t("challan.detail.column.ordered")}
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell dark:text-slate-400">
                    {t("challan.detail.column.deliveredPreviously")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t("challan.detail.column.currentDelivery")}
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell dark:text-slate-400">
                    {t("challan.detail.column.remaining")}
                  </th>
                  <th className="hidden min-w-[120px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell dark:text-slate-400">
                    {t("challan.detail.column.progress")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {detailLines.map((line) => (
                  <tr key={line.orderItemId}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {line.productName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {line.productSku}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700 dark:text-slate-300">
                      {formatQty(line.orderedQuantity, line.unit)}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm tabular-nums sm:table-cell dark:text-slate-300">
                      {formatQty(line.deliveredPreviously)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums font-semibold text-sky-700 dark:text-sky-300">
                      {formatQty(line.currentDelivery)}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm tabular-nums md:table-cell dark:text-slate-300">
                      {formatQty(line.remainingQuantity)}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <FulfillmentProgressBar percent={line.deliveryPercent} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title={t("challan.fulfillment.title")}>
          <div className="space-y-4 p-5">
            <FulfillmentProgressBar
              percent={orderPercent}
              label={t("challan.fulfillment.overall")}
            />
            {orderStatus && (
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  {t("challan.detail.orderStatus")}
                </span>
                <OrderStatusBadge status={orderStatus} />
              </div>
            )}
            {fulfillment && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {fulfillment.confirmedChallanCount} / {fulfillment.challanCount}{" "}
                {t("challan.detail.challansLinked")}
              </p>
            )}
          </div>
        </Card>

        <div className="print:hidden">
          <ChallanWorkflowActions challan={challan} userRole={userRole} />
        </div>

        <Card title={t("challan.history.title")} className="print:break-inside-avoid">
          <ChallanHistoryTimeline history={challan.auditHistory} />
        </Card>

        <button
          type="button"
          onClick={handlePrint}
          className="print:hidden inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Printer aria-hidden="true" className="size-4" />
          {t("challan.actions.print")}
        </button>
      </div>
    </div>
  );
}
