"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OrderStatus } from "@prisma/client";

import { OrderFinancialSummary } from "@/components/orders/order-financial-summary";
import { OrderFormSection } from "@/components/orders/order-form-section";
import { DealerCombobox } from "@/components/orders/dealer-combobox";
import {
  ProductLineEditor,
  type OrderLineRow,
} from "@/components/orders/product-line-editor";
import { useLanguage } from "@/contexts/LanguageContext";
import { createOrder } from "@/lib/actions/orders/create-order";
import { listDealerProjects } from "@/lib/actions/orders/list-dealer-projects";
import { previewOrderTotals } from "@/lib/actions/orders/preview-order-totals";
import { updateOrder } from "@/lib/actions/orders/update-order";
import { cn } from "@/lib/utils";
import type {
  OrderDetailDTO,
  OrderError,
  OrderProjectDTO,
  OrderTotalsPreviewDTO,
} from "@/types/order";
import type { DealerDTO } from "@/types/dealer";
import type { ProductDTO } from "@/types/product";

type ProjectMode = "none" | "existing" | "inline";

interface OrderFormProps {
  mode: "create" | "edit";
  products: ProductDTO[];
  order?: OrderDetailDTO;
  initialDealer?: DealerDTO | null;
}

interface SubmitOption {
  key: string;
  labelKey: string;
  status?: OrderStatus;
  primary: boolean;
}

let rowCounter = 0;
function newRow(): OrderLineRow {
  rowCounter += 1;
  return {
    key: `row-${Date.now()}-${rowCounter}`,
    productId: "",
    quantity: "1",
    unitPrice: "",
    priceTouched: false,
  };
}

function deriveInitialPercent(order?: OrderDetailDTO): string {
  if (!order) return "";
  const subtotal = Number(order.subtotal);
  const discount = Number(order.discount);
  if (subtotal <= 0 || discount <= 0) return "";
  return ((discount / subtotal) * 100).toFixed(2);
}

function getSubmitOptions(
  mode: "create" | "edit",
  status: OrderStatus | undefined,
): SubmitOption[] {
  if (mode === "create" || status === OrderStatus.Draft) {
    return [
      { key: "saveDraft", labelKey: "order.form.saveDraft", status: OrderStatus.Draft, primary: false },
      {
        key: "submitApproval",
        labelKey: "order.form.submitApproval",
        status: OrderStatus.Pending_Approval,
        primary: true,
      },
    ];
  }
  if (status === OrderStatus.Pending_Approval) {
    return [
      { key: "moveToDraft", labelKey: "order.form.moveToDraft", status: OrderStatus.Draft, primary: false },
      { key: "saveChanges", labelKey: "order.form.saveChanges", primary: true },
    ];
  }
  return [{ key: "saveChanges", labelKey: "order.form.saveChanges", primary: true }];
}

export function OrderForm({ mode, products, order, initialDealer }: OrderFormProps) {
  const { t, locale } = useLanguage();
  const router = useRouter();

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
  const formatMoney = useCallback(
    (value: string) => currencyFormatter.format(Number(value)),
    [currencyFormatter],
  );

  const [dealer, setDealer] = useState<DealerDTO | null>(initialDealer ?? null);
  const [projectMode, setProjectMode] = useState<ProjectMode>(
    order?.project ? "existing" : "none",
  );
  const [existingProjectId, setExistingProjectId] = useState<string>(
    order?.projectId ?? "",
  );
  const [inlineProject, setInlineProject] = useState({
    name: "",
    address: "",
    contactName: "",
    contactPhone: "",
  });
  const [lines, setLines] = useState<OrderLineRow[]>(() =>
    order
      ? order.items.map((item) => {
          rowCounter += 1;
          return {
            key: `existing-${item.id}-${rowCounter}`,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            priceTouched: true,
          };
        })
      : [newRow()],
  );
  const [discountPercent, setDiscountPercent] = useState<string>(() =>
    deriveInitialPercent(order),
  );

  const [projects, setProjects] = useState<OrderProjectDTO[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const [preview, setPreview] = useState<OrderTotalsPreviewDTO | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [lineTotals, setLineTotals] = useState<Record<string, string>>({});

  const [bannerError, setBannerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [invalidLineKeys, setInvalidLineKeys] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dirty, setDirty] = useState(false);

  const submitOptions = useMemo(
    () => getSubmitOptions(mode, order?.status),
    [mode, order?.status],
  );

  const markDirty = useCallback(() => setDirty(true), []);

  /* ----------------------------- Project loading ---------------------------- */

  useEffect(() => {
    const dealerCode = dealer?.dealerCode;
    if (!dealerCode) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setProjectsLoading(true);
      const response = await listDealerProjects({ dealerCode });
      if (cancelled) return;
      setProjects(response.success ? response.data : []);
      setProjectsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [dealer?.dealerCode]);

  /* ------------------------------ Live preview ------------------------------ */

  const previewableLines = useMemo(
    () =>
      lines.filter(
        (line) =>
          line.productId !== "" &&
          line.quantity !== "" &&
          Number(line.quantity) > 0 &&
          line.unitPrice !== "" &&
          Number.isFinite(Number(line.unitPrice)),
      ),
    [lines],
  );

  const previewKey = useMemo(
    () =>
      JSON.stringify({
        items: previewableLines.map((line) => ({
          q: line.quantity,
          p: line.unitPrice,
        })),
        d: discountPercent,
      }),
    [previewableLines, discountPercent],
  );

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(
      () => {
        void (async () => {
          if (previewableLines.length === 0) {
            setPreview(null);
            setLineTotals({});
            setPreviewLoading(false);
            return;
          }
          setPreviewLoading(true);
          const response = await previewOrderTotals({
            items: previewableLines.map((line) => ({
              quantity: line.quantity,
              unitPrice: line.unitPrice,
            })),
            discountPercent: discountPercent === "" ? undefined : discountPercent,
          });
          if (cancelled) return;
          if (response.success) {
            setPreview(response.data);
            const totals: Record<string, string> = {};
            response.data.lines.forEach((line, index) => {
              const row = previewableLines[index];
              if (row) totals[row.key] = line.total;
            });
            setLineTotals(totals);
          }
          setPreviewLoading(false);
        })();
      },
      previewableLines.length === 0 ? 0 : 300,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
    // previewKey captures the meaningful inputs; previewableLines is stable per key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  /* --------------------------- Redirect on success -------------------------- */

  const successOrderIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!submitted) return;
    const timer = window.setTimeout(() => {
      const id = successOrderIdRef.current;
      router.push(id ? `/orders/${id}` : "/orders");
      router.refresh();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [submitted, router]);

  /* ------------------------------- Handlers --------------------------------- */

  const handleDealerChange = (next: DealerDTO | null) => {
    setDealer(next);
    setProjectMode("none");
    setExistingProjectId("");
    setProjects([]);
    setFieldErrors((prev) => ({ ...prev, dealer: "" }));
    markDirty();
  };

  const handleProductSelect = (key: string, product: ProductDTO) => {
    setLines((prev) =>
      prev.map((line) =>
        line.key === key
          ? {
              ...line,
              productId: product.id,
              unitPrice: line.priceTouched ? line.unitPrice : product.currentPrice,
            }
          : line,
      ),
    );
    markDirty();
  };

  const handleQuantityChange = (key: string, value: string) => {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, quantity: value } : line)),
    );
    markDirty();
  };

  const handleUnitPriceChange = (key: string, value: string) => {
    setLines((prev) =>
      prev.map((line) =>
        line.key === key ? { ...line, unitPrice: value, priceTouched: true } : line,
      ),
    );
    markDirty();
  };

  const handleRemoveLine = (key: string) => {
    setLines((prev) => prev.filter((line) => line.key !== key));
    markDirty();
  };

  const handleAddLine = () => {
    setLines((prev) => [...prev, newRow()]);
    markDirty();
  };

  const applyServerError = (error: OrderError) => {
    setBannerError(t(error.messageKey));
    const nextFieldErrors: Record<string, string> = {};
    const nextInvalidLines = new Set<string>();
    for (const fieldErr of error.fieldErrors ?? []) {
      const { field, messageKey } = fieldErr;
      if (field === "dealerCode") {
        nextFieldErrors.dealer = messageKey;
      } else if (field === "projectId") {
        nextFieldErrors.existingProject = messageKey;
      } else if (field.startsWith("project.name")) {
        nextFieldErrors.projectName = messageKey;
      } else if (field.startsWith("items")) {
        const match = field.match(/items\.(\d+)/);
        if (match) {
          const idx = Number(match[1]);
          const row = previewableLines[idx] ?? lines[idx];
          if (row) nextInvalidLines.add(row.key);
        } else {
          lines.forEach((line) => {
            if (line.productId === "") nextInvalidLines.add(line.key);
          });
        }
      }
    }
    setFieldErrors(nextFieldErrors);
    setInvalidLineKeys(nextInvalidLines);
  };

  const validateClient = (): boolean => {
    const nextFieldErrors: Record<string, string> = {};
    const nextInvalidLines = new Set<string>();

    if (!dealer) {
      nextFieldErrors.dealer = "validation.dealerCode.required";
    }
    if (lines.length === 0) {
      setBannerError(t("order.form.itemsRequired"));
    }
    for (const line of lines) {
      const valid =
        line.productId !== "" &&
        line.quantity !== "" &&
        Number(line.quantity) > 0 &&
        line.unitPrice !== "" &&
        Number.isFinite(Number(line.unitPrice));
      if (!valid) nextInvalidLines.add(line.key);
    }
    if (projectMode === "existing" && existingProjectId === "") {
      nextFieldErrors.existingProject = "validation.projectId.invalid";
    }
    if (projectMode === "inline" && inlineProject.name.trim().length < 2) {
      nextFieldErrors.projectName = "validation.projectName.required";
    }

    setFieldErrors(nextFieldErrors);
    setInvalidLineKeys(nextInvalidLines);

    return (
      Object.keys(nextFieldErrors).length === 0 &&
      nextInvalidLines.size === 0 &&
      lines.length > 0
    );
  };

  const handleSubmit = async (status?: OrderStatus) => {
    setBannerError(null);
    if (!validateClient() || !dealer) {
      return;
    }
    setSubmitting(true);

    // Re-run the backend preview to obtain authoritative per-line discount
    // amounts; the client never computes money itself.
    const previewResult = await previewOrderTotals({
      items: lines.map((line) => ({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      discountPercent: discountPercent === "" ? undefined : discountPercent,
    });
    if (!previewResult.success) {
      setBannerError(t(previewResult.error.messageKey));
      setSubmitting(false);
      return;
    }

    const items = lines.map((line, index) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: previewResult.data.lines[index]?.discount ?? "0",
    }));

    const projectPayload =
      projectMode === "existing"
        ? { projectId: existingProjectId }
        : projectMode === "inline"
          ? {
              project: {
                name: inlineProject.name.trim(),
                address: inlineProject.address.trim() || undefined,
                contactName: inlineProject.contactName.trim() || undefined,
                contactPhone: inlineProject.contactPhone.trim() || undefined,
              },
            }
          : mode === "edit"
            ? { projectId: null }
            : {};

    const result =
      mode === "edit" && order
        ? await updateOrder({
            id: order.id,
            dealerCode: dealer.dealerCode,
            items,
            ...projectPayload,
            ...(status ? { status } : {}),
          })
        : await createOrder({
            dealerCode: dealer.dealerCode,
            items,
            ...projectPayload,
            status: status ?? OrderStatus.Draft,
          });

    if (result.success) {
      successOrderIdRef.current = result.data.id;
      setSubmitted(true);
      setSubmitting(false);
      return;
    }

    applyServerError(result.error);
    setSubmitting(false);
  };

  const isBusy = submitting || submitted;
  const projectModes: { value: ProjectMode; labelKey: string }[] = [
    { value: "none", labelKey: "order.form.project.modeNone" },
    { value: "existing", labelKey: "order.form.project.modeExisting" },
    { value: "inline", labelKey: "order.form.project.modeInline" },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="space-y-6">
        {dirty && !submitted && !isBusy && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
            {t("order.form.unsavedChanges")}
          </div>
        )}

        {submitted && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              {mode === "edit"
                ? t("order.form.updateSuccess")
                : t("order.form.createSuccess")}
            </span>
          </div>
        )}

        {bannerError && !submitted && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{bannerError}</span>
          </div>
        )}

        {/* Dealer & Project */}
        <OrderFormSection
          title={t("order.form.section.dealer")}
          description={t("order.form.section.dealerDescription")}
          sectionClassName="relative z-20"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("order.form.dealer.label")}
                <span aria-hidden="true" className="ml-1 text-rose-500">
                  *
                </span>
              </label>
              <DealerCombobox
                value={dealer}
                onChange={handleDealerChange}
                disabled={isBusy}
                hasError={Boolean(fieldErrors.dealer)}
                activeOnly
              />
              {fieldErrors.dealer && (
                <p role="alert" className="flex items-start gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                  <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  <span>{t(fieldErrors.dealer)}</span>
                </p>
              )}
              {dealer && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("order.form.dealer.balance")}:{" "}
                  <span className="tabular-nums font-medium text-slate-700 dark:text-slate-300">
                    {formatMoney(dealer.currentBalance)}
                  </span>
                  {" · "}
                  {t("order.form.dealer.creditLimit")}:{" "}
                  <span className="tabular-nums font-medium text-slate-700 dark:text-slate-300">
                    {formatMoney(dealer.creditLimit)}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("order.form.project.label")}
                <span className="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500">
                  ({t("order.form.optional")})
                </span>
              </label>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/60">
                {projectModes.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isBusy || !dealer}
                    onClick={() => {
                      setProjectMode(option.value);
                      setFieldErrors((prev) => ({
                        ...prev,
                        existingProject: "",
                        projectName: "",
                      }));
                      markDirty();
                    }}
                    className={cn(
                      "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      projectMode === option.value
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                    )}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
              {!dealer && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {t("order.form.project.requiresDealer")}
                </p>
              )}
            </div>
          </div>

          {dealer && projectMode === "existing" && (
            <div className="mt-5 flex flex-col gap-1.5">
              <label
                htmlFor="existingProject"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                {t("order.form.project.existingLabel")}
              </label>
              <select
                id="existingProject"
                disabled={isBusy || projectsLoading}
                value={existingProjectId}
                onChange={(event) => {
                  setExistingProjectId(event.target.value);
                  setFieldErrors((prev) => ({ ...prev, existingProject: "" }));
                  markDirty();
                }}
                className={cn(
                  "w-full cursor-pointer appearance-none rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 disabled:opacity-60 dark:bg-slate-950 dark:text-slate-100 sm:max-w-md",
                  fieldErrors.existingProject
                    ? "border-rose-400 focus:ring-rose-500/20 dark:border-rose-600"
                    : "border-slate-300 focus:border-slate-400 focus:ring-slate-900/10 dark:border-slate-700",
                )}
              >
                <option value="" disabled>
                  {projectsLoading
                    ? t("order.form.project.loading")
                    : t("order.form.project.existingPlaceholder")}
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.projectCode})
                  </option>
                ))}
              </select>
              {!projectsLoading && projects.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {t("order.form.project.empty")}
                </p>
              )}
              {fieldErrors.existingProject && (
                <p role="alert" className="flex items-start gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                  <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  <span>{t(fieldErrors.existingProject)}</span>
                </p>
              )}
            </div>
          )}

          {dealer && projectMode === "inline" && (
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="projectName" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("order.form.project.nameLabel")}
                  <span aria-hidden="true" className="ml-1 text-rose-500">*</span>
                </label>
                <input
                  id="projectName"
                  type="text"
                  autoComplete="off"
                  disabled={isBusy}
                  value={inlineProject.name}
                  placeholder={t("order.form.project.namePlaceholder")}
                  onChange={(event) => {
                    setInlineProject((prev) => ({ ...prev, name: event.target.value }));
                    setFieldErrors((prev) => ({ ...prev, projectName: "" }));
                    markDirty();
                  }}
                  className={cn(
                    "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 dark:bg-slate-950 dark:text-slate-100",
                    fieldErrors.projectName
                      ? "border-rose-400 focus:ring-rose-500/20 dark:border-rose-600"
                      : "border-slate-300 focus:border-slate-400 focus:ring-slate-900/10 dark:border-slate-700",
                  )}
                />
                {fieldErrors.projectName && (
                  <p role="alert" className="flex items-start gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                    <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                    <span>{t(fieldErrors.projectName)}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="projectAddress" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("order.form.project.addressLabel")}
                  <span className="ml-1 text-xs font-normal text-slate-400">({t("order.form.optional")})</span>
                </label>
                <input
                  id="projectAddress"
                  type="text"
                  autoComplete="off"
                  disabled={isBusy}
                  value={inlineProject.address}
                  placeholder={t("order.form.project.addressPlaceholder")}
                  onChange={(event) => {
                    setInlineProject((prev) => ({ ...prev, address: event.target.value }));
                    markDirty();
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="projectContactName" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("order.form.project.contactNameLabel")}
                  <span className="ml-1 text-xs font-normal text-slate-400">({t("order.form.optional")})</span>
                </label>
                <input
                  id="projectContactName"
                  type="text"
                  autoComplete="off"
                  disabled={isBusy}
                  value={inlineProject.contactName}
                  placeholder={t("order.form.project.contactNamePlaceholder")}
                  onChange={(event) => {
                    setInlineProject((prev) => ({ ...prev, contactName: event.target.value }));
                    markDirty();
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="projectContactPhone" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("order.form.project.contactPhoneLabel")}
                  <span className="ml-1 text-xs font-normal text-slate-400">({t("order.form.optional")})</span>
                </label>
                <input
                  id="projectContactPhone"
                  type="text"
                  autoComplete="off"
                  disabled={isBusy}
                  value={inlineProject.contactPhone}
                  placeholder={t("order.form.project.contactPhonePlaceholder")}
                  onChange={(event) => {
                    setInlineProject((prev) => ({ ...prev, contactPhone: event.target.value }));
                    markDirty();
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>
          )}
        </OrderFormSection>

        {/* Items */}
        <OrderFormSection
          title={t("order.form.section.items")}
          description={t("order.form.section.itemsDescription")}
        >
          <ProductLineEditor
            lines={lines}
            products={products}
            lineTotals={lineTotals}
            disabled={isBusy}
            invalidKeys={invalidLineKeys}
            formatMoney={formatMoney}
            onProductSelect={handleProductSelect}
            onQuantityChange={handleQuantityChange}
            onUnitPriceChange={handleUnitPriceChange}
            onRemove={handleRemoveLine}
            onAdd={handleAddLine}
          />
        </OrderFormSection>

        {/* Actions */}
        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            disabled={isBusy}
            onClick={() =>
              router.push(mode === "edit" && order ? `/orders/${order.id}` : "/orders")
            }
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("order.form.cancel")}
          </button>
          {submitOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              disabled={isBusy}
              onClick={() => void handleSubmit(option.status)}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                option.primary
                  ? "bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
              )}
            >
              {isBusy && option.primary && (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              )}
              {isBusy && option.primary ? t("order.form.saving") : t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="lg:sticky lg:top-6">
        <OrderFinancialSummary
          discountPercent={discountPercent}
          onDiscountPercentChange={(value) => {
            setDiscountPercent(value);
            markDirty();
          }}
          preview={preview}
          loading={previewLoading}
          disabled={isBusy}
          hasItems={previewableLines.length > 0}
          formatMoney={formatMoney}
        />
      </div>
    </div>
  );
}
