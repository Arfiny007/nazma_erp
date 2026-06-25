"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { DeliveryMode } from "@prisma/client";

import { ChallanFulfillmentSummary } from "@/components/delivery-challans/challan-fulfillment-summary";
import {
  ChallanLineEditor,
  type ChallanLineInput,
} from "@/components/delivery-challans/challan-line-editor";
import { EligibleOrderCombobox } from "@/components/delivery-challans/eligible-order-combobox";
import { OrderFormSection } from "@/components/orders/order-form-section";
import { useLanguage } from "@/contexts/LanguageContext";
import { createDeliveryChallan } from "@/lib/actions/delivery-challans/create-delivery-challan";
import { confirmDeliveryChallan } from "@/lib/actions/delivery-challans/confirm-delivery-challan";
import { getOrderChallanContext } from "@/lib/actions/delivery-challans/get-order-challan-context";
import { updateDeliveryChallan } from "@/lib/actions/delivery-challans/update-delivery-challan";
import { isQuantityPositive, isQuantityWithinAllocatable } from "@/lib/delivery/quantity-client";
import type {
  DeliveryChallanDetailDTO,
  DeliveryChallanError,
  OrderChallanContextDTO,
} from "@/types/delivery-challan";
import type { OrderSummaryDTO } from "@/types/order";

const DELIVERY_MODES: DeliveryMode[] = [
  DeliveryMode.Truck,
  DeliveryMode.Courier,
  DeliveryMode.Pickup,
  DeliveryMode.Company_Delivery,
];

interface ChallanFormProps {
  mode: "create" | "edit";
  challan?: DeliveryChallanDetailDTO;
  initialOrder?: OrderSummaryDTO | null;
  initialContext?: OrderChallanContextDTO | null;
}

export function ChallanForm({
  mode,
  challan,
  initialOrder = null,
  initialContext = null,
}: ChallanFormProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const [selectedOrder, setSelectedOrder] = useState<OrderSummaryDTO | null>(
    initialOrder,
  );
  const [context, setContext] = useState<OrderChallanContextDTO | null>(
    initialContext,
  );
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  const [lineValues, setLineValues] = useState<ChallanLineInput[]>(() => {
    if (mode === "edit" && challan && initialContext) {
      return initialContext.lines.map((line) => {
        const challanLine = challan.items.find(
          (item) => item.orderItemId === line.orderItemId,
        );
        return {
          orderItemId: line.orderItemId,
          quantity: challanLine?.quantity ?? "",
        };
      });
    }
    if (mode === "edit" && challan) {
      return challan.items.map((item) => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
      }));
    }
    return [];
  });

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(
    challan?.deliveryMode as DeliveryMode ?? DeliveryMode.Truck,
  );
  const [vehicleNo, setVehicleNo] = useState(challan?.vehicleNo ?? "");
  const [driverName, setDriverName] = useState(challan?.driverName ?? "");
  const [remarks, setRemarks] = useState(challan?.remarks ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const loadContext = useCallback(
    async (orderId: string) => {
      setContextLoading(true);
      setContextError(null);
      const result = await getOrderChallanContext({
        orderId,
        excludeChallanId: mode === "edit" ? challan?.id : undefined,
      });
      if (result.success) {
        setContext(result.data);
        if (mode === "create") {
          setLineValues(
            result.data.lines.map((line) => ({
              orderItemId: line.orderItemId,
              quantity: "",
            })),
          );
        }
      } else {
        setContext(null);
        setContextError(t(result.error.messageKey));
      }
      setContextLoading(false);
    },
    [mode, challan?.id, t],
  );

  const currentQuantities = useMemo(() => {
    const map: Record<string, string> = {};
    for (const line of lineValues) {
      if (line.quantity.trim()) {
        map[line.orderItemId] = line.quantity;
      }
    }
    return map;
  }, [lineValues]);

  const applyServerError = (error: DeliveryChallanError) => {
    setBannerError(t(error.messageKey));
    if (error.fieldErrors) {
      const next: Record<string, string> = {};
      for (const fe of error.fieldErrors) {
        const key = fe.field.includes("orderItemId")
          ? fe.field
          : fe.field.replace(/^items\./, "");
        if (key.includes(".")) {
          const parts = key.split(".");
          const itemId = parts.find((p) => p.length === 36);
          if (itemId) next[itemId] = fe.messageKey;
        } else {
          next[fe.field] = fe.messageKey;
        }
      }
      setFieldErrors(next);
    }
  };

  const handleLineChange = (orderItemId: string, quantity: string) => {
    setLineValues((prev) => {
      const existing = prev.find((l) => l.orderItemId === orderItemId);
      if (existing) {
        return prev.map((l) =>
          l.orderItemId === orderItemId ? { ...l, quantity } : l,
        );
      }
      return [...prev, { orderItemId, quantity }];
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[orderItemId];
      return next;
    });
  };

  const validateClient = (): boolean => {
    if (!context) return false;
    const errors: Record<string, string> = {};
    let hasPositive = false;

    for (const line of context.lines) {
      const qty = lineValues.find((v) => v.orderItemId === line.orderItemId)?.quantity ?? "";
      if (!qty.trim()) continue;
      if (!isQuantityPositive(qty)) {
        errors[line.orderItemId] = "validation.quantity.positive";
        continue;
      }
      if (!isQuantityWithinAllocatable(qty, line.allocatableQuantity)) {
        errors[line.orderItemId] = "challan.error.overDelivery";
        continue;
      }
      hasPositive = true;
    }

    if (!hasPositive) {
      setBannerError(t("challan.error.empty"));
      return false;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setBannerError(t("challan.error.validation"));
      return false;
    }

    return true;
  };

  const buildItems = () =>
    lineValues
      .filter((line) => line.quantity.trim() && isQuantityPositive(line.quantity))
      .map((line) => ({
        orderItemId: line.orderItemId,
        quantity: line.quantity.trim(),
      }));

  const handleSubmit = async (action: "draft" | "confirm") => {
    setBannerError(null);
    setFieldErrors({});
    if (!validateClient()) return;
    if (!context) return;

    setSubmitting(true);

    const payload = {
      items: buildItems(),
      deliveryMode,
      vehicleNo: vehicleNo.trim() || null,
      driverName: driverName.trim() || null,
      remarks: remarks.trim() || null,
    };

    const result =
      mode === "create"
        ? await createDeliveryChallan({
            orderId: context.orderId,
            ...payload,
          })
        : await updateDeliveryChallan({
            id: challan!.id,
            ...payload,
          });

    if (!result.success) {
      applyServerError(result.error);
      setSubmitting(false);
      return;
    }

    if (action === "confirm") {
      const confirmResult = await confirmDeliveryChallan({ id: result.data.id });
      if (!confirmResult.success) {
        applyServerError(confirmResult.error);
        setSubmitting(false);
        router.push(`/delivery-challans/${result.data.id}`);
        return;
      }
    }

    setSuccess(true);
    setSubmitting(false);
    setTimeout(() => {
      router.push(`/delivery-challans/${result.data.id}`);
      router.refresh();
    }, 800);
  };

  const isReadOnly = mode === "edit" && challan?.status !== "Draft";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit("draft");
      }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="space-y-6">
        {bannerError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{bannerError}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{t("challan.form.success")}</span>
          </div>
        )}

        {mode === "create" && (
          <OrderFormSection
            title={t("challan.form.section.order")}
            description={t("challan.form.section.orderDescription")}
            sectionClassName="relative z-20"
          >
            <EligibleOrderCombobox
              value={selectedOrder}
              onChange={(order) => {
                setSelectedOrder(order);
                setContext(null);
                setLineValues([]);
                setContextError(null);
                if (order) {
                  void loadContext(order.id);
                }
              }}
              disabled={submitting}
            />
          </OrderFormSection>
        )}

        {contextLoading && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white py-12 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Loader2 aria-hidden="true" className="size-5 animate-spin text-slate-400" />
            <span className="text-sm text-slate-500">{t("challan.form.loadingLines")}</span>
          </div>
        )}

        {contextError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {contextError}
          </div>
        )}

        {context && !contextLoading && (
          <>
            <OrderFormSection
              title={t("challan.form.section.logistics")}
              description={t("challan.form.section.logisticsDescription")}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label
                    htmlFor="deliveryMode"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    {t("challan.form.deliveryMode")}
                  </label>
                  <select
                    id="deliveryMode"
                    value={deliveryMode}
                    disabled={isReadOnly || submitting}
                    onChange={(event) =>
                      setDeliveryMode(event.target.value as DeliveryMode)
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {DELIVERY_MODES.map((modeOption) => (
                      <option key={modeOption} value={modeOption}>
                        {t(`challan.deliveryMode.${modeOption}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="vehicleNo"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    {t("challan.form.vehicleNo")}
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      ({t("order.form.optional")})
                    </span>
                  </label>
                  <input
                    id="vehicleNo"
                    type="text"
                    disabled={isReadOnly || submitting}
                    value={vehicleNo}
                    onChange={(event) => setVehicleNo(event.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="driverName"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    {t("challan.form.driverName")}
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      ({t("order.form.optional")})
                    </span>
                  </label>
                  <input
                    id="driverName"
                    type="text"
                    disabled={isReadOnly || submitting}
                    value={driverName}
                    onChange={(event) => setDriverName(event.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                {mode === "edit" && (
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label
                      htmlFor="remarks"
                      className="text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      {t("challan.form.remarks")}
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        ({t("order.form.optional")})
                      </span>
                    </label>
                    <textarea
                      id="remarks"
                      rows={2}
                      disabled={isReadOnly || submitting}
                      value={remarks}
                      onChange={(event) => setRemarks(event.target.value)}
                      className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                )}
              </div>
            </OrderFormSection>

            <OrderFormSection
              title={t("challan.form.section.lines")}
              description={t("challan.form.section.linesDescription")}
              flush
            >
              <ChallanLineEditor
                lines={context.lines}
                values={lineValues}
                onChange={handleLineChange}
                fieldErrors={fieldErrors}
                disabled={isReadOnly || submitting}
              />
            </OrderFormSection>
          </>
        )}

        {context && !isReadOnly && (
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={submitting || contextLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {submitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
              {mode === "create"
                ? t("challan.form.saveDraft")
                : t("challan.form.saveChanges")}
            </button>
            <button
              type="button"
              disabled={submitting || contextLoading}
              onClick={() => void handleSubmit("confirm")}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
              {t("challan.form.saveAndConfirm")}
            </button>
          </div>
        )}
      </div>

      {context && (
        <ChallanFulfillmentSummary
          lines={context.lines}
          currentQuantities={currentQuantities}
        />
      )}
    </form>
  );
}
