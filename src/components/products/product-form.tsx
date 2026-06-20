"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import type { z } from "zod";

import { ProductFormSection } from "@/components/products/product-form-section";
import { useLanguage } from "@/contexts/LanguageContext";
import { createProduct } from "@/lib/actions/products/create-product";
import { updateProduct } from "@/lib/actions/products/update-product";
import { cn } from "@/lib/utils";
import { createProductSchema } from "@/lib/validators/product.schema";
import type { CategoryDTO, ProductDTO, ProductError } from "@/types/product";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type ProductFormInput = z.input<typeof createProductSchema>;
type ProductFormOutput = z.output<typeof createProductSchema>;

type ProductFormMode = "create" | "edit";

interface ProductFormProps {
  mode: ProductFormMode;
  product?: ProductDTO;
  categories: CategoryDTO[];
}

const EDITABLE_FIELDS = [
  "sku",
  "modelNumber",
  "name",
  "nameBn",
  "categoryId",
  "unit",
  "description",
  "currentPrice",
  "isActive",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

function isEditableField(value: string): value is EditableField {
  return (EDITABLE_FIELDS as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/*                            Currency input helpers                          */
/* -------------------------------------------------------------------------- */

function sanitizeMoneyInput(value: string): string {
  let cleaned = value.replace(/[^\d.]/g, "");

  const dotIndex = cleaned.indexOf(".");
  if (dotIndex !== -1) {
    cleaned =
      cleaned.slice(0, dotIndex + 1) +
      cleaned.slice(dotIndex + 1).replace(/\./g, "");
  }

  const [intPart, decPart] = cleaned.split(".");
  let normalizedInt = intPart.replace(/^0+(?=\d)/, "");

  if (decPart === undefined) {
    return normalizedInt;
  }

  if (normalizedInt === "") {
    normalizedInt = "0";
  }

  return `${normalizedInt}.${decPart.slice(0, 2)}`;
}

function formatMoneyDisplay(raw: string): string {
  if (raw === "") return "";
  const [intPart, decPart] = raw.split(".");
  const grouped = new Intl.NumberFormat("en-US").format(
    BigInt(intPart === "" ? "0" : intPart),
  );
  return decPart === undefined ? grouped : `${grouped}.${decPart}`;
}

function normalizeMoneyOnBlur(raw: string): string {
  return raw.endsWith(".") ? raw.slice(0, -1) : raw;
}

/* -------------------------------------------------------------------------- */
/*                              Styling constants                             */
/* -------------------------------------------------------------------------- */

const inputBase =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500";
const inputNormal =
  "border-slate-300 focus:border-slate-400 focus:ring-slate-900/10 dark:border-slate-700 dark:focus:border-slate-600 dark:focus:ring-white/10";
const inputErrored =
  "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-600";

function controlClass(hasError: boolean): string {
  return cn(inputBase, hasError ? inputErrored : inputNormal);
}

const moneyWrapperBase =
  "flex items-center overflow-hidden rounded-lg border bg-white shadow-sm transition-colors focus-within:ring-2 dark:bg-slate-950";
const moneyWrapperNormal =
  "border-slate-300 focus-within:border-slate-400 focus-within:ring-slate-900/10 dark:border-slate-700 dark:focus-within:border-slate-600 dark:focus-within:ring-white/10";
const moneyWrapperErrored =
  "border-rose-400 focus-within:border-rose-500 focus-within:ring-rose-500/20 dark:border-rose-600";

/* -------------------------------------------------------------------------- */
/*                              Field components                              */
/* -------------------------------------------------------------------------- */

interface FieldShellProps {
  htmlFor: string;
  label: string;
  required?: boolean;
  optionalLabel?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

function FieldShell({
  htmlFor,
  label,
  required,
  optionalLabel,
  error,
  hint,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        <span>{label}</span>
        {required && (
          <span aria-hidden="true" className="text-rose-500">
            *
          </span>
        )}
        {optionalLabel && (
          <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
            ({optionalLabel})
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p
          role="alert"
          className="flex items-start gap-1 text-xs font-medium text-rose-600 dark:text-rose-400"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

interface MoneyInputProps {
  id: string;
  value: string;
  symbol: string;
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  onBlur: () => void;
}

function MoneyInput({
  id,
  value,
  symbol,
  placeholder,
  hasError,
  disabled,
  onValueChange,
  onBlur,
}: MoneyInputProps) {
  const [focused, setFocused] = useState(false);
  const display = focused ? value : formatMoneyDisplay(value);

  return (
    <div
      className={cn(
        moneyWrapperBase,
        hasError ? moneyWrapperErrored : moneyWrapperNormal,
        disabled && "opacity-60",
      )}
    >
      <span className="pointer-events-none select-none border-r border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {symbol}
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        value={display}
        placeholder={placeholder}
        aria-invalid={hasError || undefined}
        onChange={(event) => onValueChange(sanitizeMoneyInput(event.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onValueChange(normalizeMoneyOnBlur(value));
          onBlur();
        }}
        className="w-full bg-transparent px-3 py-2 text-right text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Main form                                  */
/* -------------------------------------------------------------------------- */

export function ProductForm({ mode, product, categories }: ProductFormProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const [submitted, setSubmitted] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  useEffect(() => {
    if (!submitted) return;
    const timer = window.setTimeout(() => {
      router.push("/products");
      router.refresh();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [submitted, router]);

  const defaultValues: ProductFormInput =
    mode === "edit" && product
      ? {
          sku: product.sku,
          modelNumber: product.modelNumber,
          name: product.name,
          nameBn: product.nameBn ?? "",
          categoryId: product.categoryId,
          unit: product.unit,
          description: product.description ?? "",
          currentPrice: product.currentPrice,
          isActive: product.isActive,
        }
      : {
          sku: "",
          modelNumber: "",
          name: "",
          nameBn: "",
          categoryId: "",
          unit: "PCS",
          description: "",
          currentPrice: "",
          isActive: true,
        };

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProductFormInput, unknown, ProductFormOutput>({
    resolver: zodResolver(createProductSchema),
    defaultValues,
    mode: "onBlur",
  });

  const fieldError = (name: EditableField): string | undefined => {
    const message = errors[name]?.message;
    return typeof message === "string" ? t(message) : undefined;
  };

  const applyServerError = (error: ProductError) => {
    setBannerError(t(error.messageKey));
    for (const fieldErr of error.fieldErrors ?? []) {
      if (isEditableField(fieldErr.field)) {
        setError(fieldErr.field, {
          type: "server",
          message: fieldErr.messageKey,
        });
      }
    }
  };

  const onSubmit: SubmitHandler<ProductFormOutput> = async (values) => {
    setBannerError(null);

    const result =
      mode === "edit" && product
        ? await updateProduct({ id: product.id, ...values })
        : await createProduct(values);

    if (result.success) {
      setSubmitted(true);
      return;
    }

    applyServerError(result.error);
  };

  const isBusy = isSubmitting || submitted;
  const symbol = t("products.form.currencySymbol");

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      aria-busy={isBusy}
    >
      {/* Unsaved changes indicator */}
      {isDirty && !submitted && !isBusy && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
          {t("products.form.unsavedChanges")}
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
              ? t("products.form.updateSuccess")
              : t("products.form.createSuccess")}
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

      {/* Identity section */}
      <ProductFormSection
        title={t("products.form.section.identity")}
        description={t("products.form.section.identityDescription")}
      >
        <FieldShell
          htmlFor="modelNumber"
          label={t("products.form.field.modelNumber")}
          required
          error={fieldError("modelNumber")}
          hint={t("products.form.hint.modelNumber")}
        >
          <input
            id="modelNumber"
            type="text"
            autoComplete="off"
            disabled={isBusy}
            placeholder={t("products.form.placeholder.modelNumber")}
            aria-invalid={Boolean(errors.modelNumber) || undefined}
            className={cn(
              controlClass(Boolean(errors.modelNumber)),
              "font-mono uppercase",
            )}
            {...register("modelNumber")}
          />
        </FieldShell>

        <FieldShell
          htmlFor="sku"
          label={t("products.form.field.sku")}
          required
          error={fieldError("sku")}
          hint={t("products.form.hint.sku")}
        >
          <input
            id="sku"
            type="text"
            autoComplete="off"
            disabled={isBusy}
            placeholder={t("products.form.placeholder.sku")}
            aria-invalid={Boolean(errors.sku) || undefined}
            className={cn(
              controlClass(Boolean(errors.sku)),
              "font-mono uppercase",
            )}
            {...register("sku")}
          />
        </FieldShell>
      </ProductFormSection>

      {/* Name section */}
      <ProductFormSection
        title={t("products.form.section.naming")}
        description={t("products.form.section.namingDescription")}
      >
        <FieldShell
          htmlFor="name"
          label={t("products.form.field.name")}
          required
          error={fieldError("name")}
        >
          <input
            id="name"
            type="text"
            autoComplete="off"
            disabled={isBusy}
            placeholder={t("products.form.placeholder.name")}
            aria-invalid={Boolean(errors.name) || undefined}
            className={controlClass(Boolean(errors.name))}
            {...register("name")}
          />
        </FieldShell>

        <FieldShell
          htmlFor="nameBn"
          label={t("products.form.field.nameBn")}
          optionalLabel={t("products.form.optional")}
          error={fieldError("nameBn")}
        >
          <input
            id="nameBn"
            type="text"
            autoComplete="off"
            disabled={isBusy}
            placeholder={t("products.form.placeholder.nameBn")}
            aria-invalid={Boolean(errors.nameBn) || undefined}
            className={controlClass(Boolean(errors.nameBn))}
            {...register("nameBn")}
          />
        </FieldShell>
      </ProductFormSection>

      {/* Classification section */}
      <ProductFormSection
        title={t("products.form.section.classification")}
        description={t("products.form.section.classificationDescription")}
      >
        <FieldShell
          htmlFor="categoryId"
          label={t("products.form.field.category")}
          required
          error={fieldError("categoryId")}
        >
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <select
                id="categoryId"
                disabled={isBusy}
                aria-invalid={Boolean(errors.categoryId) || undefined}
                className={cn(
                  controlClass(Boolean(errors.categoryId)),
                  "cursor-pointer appearance-none",
                )}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
              >
                <option value="" disabled>
                  {t("products.form.placeholder.category")}
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
          />
        </FieldShell>

        <FieldShell
          htmlFor="unit"
          label={t("products.form.field.unit")}
          required
          error={fieldError("unit")}
          hint={t("products.form.hint.unit")}
        >
          <input
            id="unit"
            type="text"
            autoComplete="off"
            disabled={isBusy}
            placeholder={t("products.form.placeholder.unit")}
            aria-invalid={Boolean(errors.unit) || undefined}
            className={controlClass(Boolean(errors.unit))}
            {...register("unit")}
          />
        </FieldShell>
      </ProductFormSection>

      {/* Pricing & status section */}
      <ProductFormSection
        title={t("products.form.section.pricing")}
        description={t("products.form.section.pricingDescription")}
      >
        <FieldShell
          htmlFor="currentPrice"
          label={t("products.form.field.currentPrice")}
          required
          error={fieldError("currentPrice")}
        >
          <Controller
            control={control}
            name="currentPrice"
            render={({ field }) => (
              <MoneyInput
                id="currentPrice"
                symbol={symbol}
                placeholder={t("products.form.placeholder.currentPrice")}
                disabled={isBusy}
                hasError={Boolean(errors.currentPrice)}
                value={
                  typeof field.value === "string"
                    ? field.value
                    : String(field.value ?? "")
                }
                onValueChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </FieldShell>

        <FieldShell
          htmlFor="isActive"
          label={t("products.form.field.isActive")}
          hint={t("products.form.activeHint")}
        >
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => {
              const active = Boolean(field.value);
              return (
                <div className="flex h-[42px] items-center gap-3">
                  <button
                    id="isActive"
                    type="button"
                    role="switch"
                    aria-checked={active}
                    disabled={isBusy}
                    onClick={() => field.onChange(!active)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-white/20",
                      active
                        ? "bg-emerald-500"
                        : "bg-slate-300 dark:bg-slate-700",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block size-4 transform rounded-full bg-white shadow transition-transform",
                        active ? "translate-x-6" : "translate-x-1",
                      )}
                    />
                  </button>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {active
                      ? t("products.form.active")
                      : t("products.form.inactive")}
                  </span>
                </div>
              );
            }}
          />
        </FieldShell>
      </ProductFormSection>

      {/* Description section */}
      <ProductFormSection
        title={t("products.form.section.details")}
        description={t("products.form.section.detailsDescription")}
      >
        <FieldShell
          htmlFor="description"
          label={t("products.form.field.description")}
          optionalLabel={t("products.form.optional")}
          error={fieldError("description")}
          className="sm:col-span-2"
        >
          <textarea
            id="description"
            rows={3}
            autoComplete="off"
            disabled={isBusy}
            placeholder={t("products.form.placeholder.description")}
            aria-invalid={Boolean(errors.description) || undefined}
            className={cn(controlClass(Boolean(errors.description)), "resize-none")}
            {...register("description")}
          />
        </FieldShell>
      </ProductFormSection>

      {/* Form actions */}
      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => router.push("/products")}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {t("products.form.cancel")}
        </button>
        <button
          type="submit"
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {isBusy && (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          )}
          {isBusy ? t("products.form.saving") : t("products.form.save")}
        </button>
      </div>
    </form>
  );
}
