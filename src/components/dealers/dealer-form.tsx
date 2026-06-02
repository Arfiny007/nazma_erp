"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import type { z } from "zod";

import { DealerFormSection } from "@/components/dealers/dealer-form-section";
import { useLanguage } from "@/contexts/LanguageContext";
import { createDealer } from "@/lib/actions/dealers/create-dealer";
import { updateDealer } from "@/lib/actions/dealers/update-dealer";
import { cn } from "@/lib/utils";
import { createDealerSchema } from "@/lib/validators/dealer.schema";
import type { DealerDTO, DealerError } from "@/types/dealer";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

/** Raw values held by the form controls (pre Zod transform). */
type DealerFormInput = z.input<typeof createDealerSchema>;
/** Transformed, validated values handed to the server actions. */
type DealerFormOutput = z.output<typeof createDealerSchema>;

type DealerFormMode = "create" | "edit";

interface DealerFormProps {
  mode: DealerFormMode;
  /** Existing dealer to pre-fill the form with. Required in `edit` mode. */
  dealer?: DealerDTO;
}

const EDITABLE_FIELDS = [
  "companyName",
  "proprietorName",
  "mobile",
  "email",
  "address",
  "district",
  "territory",
  "creditLimit",
  "isActive",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

function isEditableField(value: string): value is EditableField {
  return (EDITABLE_FIELDS as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/*                            Currency input helpers                          */
/* -------------------------------------------------------------------------- */

/**
 * Strips a user-entered string down to a backend-safe, non-negative decimal:
 * digits with at most one dot and two fractional places. No floating-point math
 * is performed so the value stays exact for `Decimal(18,2)` persistence.
 */
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

/** Groups the integer part with thousands separators for display only. */
function formatMoneyDisplay(raw: string): string {
  if (raw === "") {
    return "";
  }

  const [intPart, decPart] = raw.split(".");
  const grouped = new Intl.NumberFormat("en-US").format(
    BigInt(intPart === "" ? "0" : intPart),
  );

  return decPart === undefined ? grouped : `${grouped}.${decPart}`;
}

/** Removes a trailing dot left over from interactive editing. */
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

export function DealerForm({ mode, dealer }: DealerFormProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const [submitted, setSubmitted] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  useEffect(() => {
    if (!submitted) {
      return;
    }

    const timer = window.setTimeout(() => {
      router.push("/dealers");
      router.refresh();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [submitted, router]);

  const defaultValues: DealerFormInput =
    mode === "edit" && dealer
      ? {
          companyName: dealer.companyName,
          proprietorName: dealer.proprietorName ?? "",
          mobile: dealer.mobile,
          email: dealer.email ?? "",
          address: dealer.address,
          district: dealer.district,
          territory: dealer.territory,
          creditLimit: dealer.creditLimit,
          isActive: dealer.isActive,
        }
      : {
          companyName: "",
          proprietorName: "",
          mobile: "",
          email: "",
          address: "",
          district: "",
          territory: "",
          creditLimit: "",
          isActive: true,
        };

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DealerFormInput, unknown, DealerFormOutput>({
    resolver: zodResolver(createDealerSchema),
    defaultValues,
    mode: "onBlur",
  });

  const fieldError = (name: EditableField): string | undefined => {
    const message = errors[name]?.message;
    return typeof message === "string" ? t(message) : undefined;
  };

  const applyServerError = (error: DealerError) => {
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

  const onSubmit: SubmitHandler<DealerFormOutput> = async (values) => {
    setBannerError(null);

    const result =
      mode === "edit" && dealer
        ? await updateDealer({ id: dealer.id, ...values })
        : await createDealer(values);

    if (result.success) {
      setSubmitted(true);
      return;
    }

    applyServerError(result.error);
  };

  const isBusy = isSubmitting || submitted;
  const symbol = t("dealers.form.currencySymbol");

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      aria-busy={isBusy}
    >
      {submitted && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {mode === "edit"
              ? t("dealers.form.updateSuccess")
              : t("dealers.form.createSuccess")}
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

      <DealerFormSection
        title={t("dealers.form.section.company")}
        description={t("dealers.form.section.companyDescription")}
      >
        <FieldShell
          htmlFor="companyName"
          label={t("dealers.form.field.companyName")}
          required
          error={fieldError("companyName")}
        >
          <input
            id="companyName"
            type="text"
            autoComplete="organization"
            disabled={isBusy}
            placeholder={t("dealers.form.placeholder.companyName")}
            aria-invalid={Boolean(errors.companyName) || undefined}
            className={controlClass(Boolean(errors.companyName))}
            {...register("companyName")}
          />
        </FieldShell>

        <FieldShell
          htmlFor="proprietorName"
          label={t("dealers.form.field.proprietorName")}
          optionalLabel={t("dealers.form.optional")}
          error={fieldError("proprietorName")}
        >
          <input
            id="proprietorName"
            type="text"
            autoComplete="name"
            disabled={isBusy}
            placeholder={t("dealers.form.placeholder.proprietorName")}
            aria-invalid={Boolean(errors.proprietorName) || undefined}
            className={controlClass(Boolean(errors.proprietorName))}
            {...register("proprietorName")}
          />
        </FieldShell>
      </DealerFormSection>

      <DealerFormSection
        title={t("dealers.form.section.contact")}
        description={t("dealers.form.section.contactDescription")}
      >
        <FieldShell
          htmlFor="mobile"
          label={t("dealers.form.field.mobile")}
          required
          error={fieldError("mobile")}
        >
          <input
            id="mobile"
            type="text"
            inputMode="tel"
            autoComplete="tel"
            disabled={isBusy}
            placeholder={t("dealers.form.placeholder.mobile")}
            aria-invalid={Boolean(errors.mobile) || undefined}
            className={controlClass(Boolean(errors.mobile))}
            {...register("mobile")}
          />
        </FieldShell>

        <FieldShell
          htmlFor="email"
          label={t("dealers.form.field.email")}
          optionalLabel={t("dealers.form.optional")}
          error={fieldError("email")}
        >
          <input
            id="email"
            type="text"
            inputMode="email"
            autoComplete="email"
            disabled={isBusy}
            placeholder={t("dealers.form.placeholder.email")}
            aria-invalid={Boolean(errors.email) || undefined}
            className={controlClass(Boolean(errors.email))}
            {...register("email")}
          />
        </FieldShell>
      </DealerFormSection>

      <DealerFormSection
        title={t("dealers.form.section.location")}
        description={t("dealers.form.section.locationDescription")}
      >
        <FieldShell
          htmlFor="address"
          label={t("dealers.form.field.address")}
          required
          error={fieldError("address")}
          className="sm:col-span-2"
        >
          <textarea
            id="address"
            rows={2}
            autoComplete="street-address"
            disabled={isBusy}
            placeholder={t("dealers.form.placeholder.address")}
            aria-invalid={Boolean(errors.address) || undefined}
            className={cn(controlClass(Boolean(errors.address)), "resize-none")}
            {...register("address")}
          />
        </FieldShell>

        <FieldShell
          htmlFor="district"
          label={t("dealers.form.field.district")}
          required
          error={fieldError("district")}
        >
          <input
            id="district"
            type="text"
            autoComplete="address-level2"
            disabled={isBusy}
            placeholder={t("dealers.form.placeholder.district")}
            aria-invalid={Boolean(errors.district) || undefined}
            className={controlClass(Boolean(errors.district))}
            {...register("district")}
          />
        </FieldShell>

        <FieldShell
          htmlFor="territory"
          label={t("dealers.form.field.territory")}
          required
          error={fieldError("territory")}
        >
          <input
            id="territory"
            type="text"
            autoComplete="off"
            disabled={isBusy}
            placeholder={t("dealers.form.placeholder.territory")}
            aria-invalid={Boolean(errors.territory) || undefined}
            className={controlClass(Boolean(errors.territory))}
            {...register("territory")}
          />
        </FieldShell>
      </DealerFormSection>

      <DealerFormSection
        title={t("dealers.form.section.credit")}
        description={t("dealers.form.section.creditDescription")}
      >
        <FieldShell
          htmlFor="creditLimit"
          label={t("dealers.form.field.creditLimit")}
          required
          error={fieldError("creditLimit")}
        >
          <Controller
            control={control}
            name="creditLimit"
            render={({ field }) => (
              <MoneyInput
                id="creditLimit"
                symbol={symbol}
                placeholder={t("dealers.form.placeholder.creditLimit")}
                disabled={isBusy}
                hasError={Boolean(errors.creditLimit)}
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
          label={t("dealers.form.field.isActive")}
          hint={t("dealers.form.activeHint")}
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
                      ? t("dealers.form.active")
                      : t("dealers.form.inactive")}
                  </span>
                </div>
              );
            }}
          />
        </FieldShell>
      </DealerFormSection>

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => router.push("/dealers")}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {t("dealers.form.cancel")}
        </button>
        <button
          type="submit"
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {isBusy && (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          )}
          {isBusy ? t("dealers.form.saving") : t("dealers.form.save")}
        </button>
      </div>
    </form>
  );
}
