"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { createOpeningBalanceDraft } from "@/lib/actions/opening-balance/create-opening-balance-draft";
import { getInitializationStatus } from "@/lib/actions/opening-balance/get-initialization-status";
import { postOpeningBalance } from "@/lib/actions/opening-balance/post-opening-balance";
import { validateOpeningBalance } from "@/lib/actions/opening-balance/validate-opening-balance";
import { useFormatMoney } from "@/lib/utils/use-format-money";
import { cn } from "@/lib/utils";
import type {
  OpeningBalanceDTO,
  OpeningBalanceFieldError,
  UninitializedDealerDTO,
} from "@/types/opening-balance";

import { OpeningBalanceStatusBadge } from "./opening-balance-status-badge";
import { UninitializedDealersTable } from "./uninitialized-dealers-table";

type WizardStep =
  | "dealer"
  | "entry"
  | "validation"
  | "confirmation"
  | "posting"
  | "success";

const STEP_ORDER: WizardStep[] = [
  "dealer",
  "entry",
  "validation",
  "confirmation",
  "posting",
  "success",
];

interface OpeningBalanceWizardProps {
  /** When provided, the wizard skips Dealer Selection and resumes/starts for this dealer. */
  initialDealerCode?: string;
}

interface DealerContext {
  dealerCode: string;
  companyName: string;
}

export function OpeningBalanceWizard({ initialDealerCode }: OpeningBalanceWizardProps) {
  const { t, locale } = useLanguage();
  const formatMoney = useFormatMoney(locale);

  const [step, setStep] = useState<WizardStep>(initialDealerCode ? "entry" : "dealer");
  const [resolving, setResolving] = useState(Boolean(initialDealerCode));
  const [dealer, setDealer] = useState<DealerContext | null>(null);

  const [amount, setAmount] = useState("0.00");
  const [effectiveDate, setEffectiveDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [remarks, setRemarks] = useState("");

  const [draft, setDraft] = useState<OpeningBalanceDTO | null>(null);
  const [validationIssues, setValidationIssues] = useState<
    OpeningBalanceFieldError[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Resume an in-progress record when the wizard is opened for a specific dealer.
  useEffect(() => {
    if (!initialDealerCode) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await getInitializationStatus({ dealerCode: initialDealerCode });
      if (cancelled) return;
      if (!result.success) {
        setError(t(result.error.messageKey));
        setResolving(false);
        return;
      }
      setDealer({
        dealerCode: result.data.dealerCode,
        companyName: result.data.dealerName,
      });
      const existing = result.data.openingBalance;
      if (existing) {
        setDraft(existing);
        setAmount(existing.amount);
        setEffectiveDate(existing.effectiveDate.slice(0, 10));
        setRemarks(existing.remarks ?? "");
        if (existing.status === "Locked" || existing.status === "Posted") {
          setStep("success");
        } else if (existing.status === "Validated") {
          setStep("confirmation");
        } else {
          setStep("entry");
        }
      } else {
        setStep("entry");
      }
      setResolving(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialDealerCode, t]);

  const stepIndex = STEP_ORDER.indexOf(step);

  const handleDealerSelect = (selected: UninitializedDealerDTO) => {
    setDealer({ dealerCode: selected.dealerCode, companyName: selected.companyName });
    setError(null);
    setStep("entry");
  };

  const handleCreateDraft = async () => {
    if (!dealer) return;
    setSubmitting(true);
    setError(null);

    const result = await createOpeningBalanceDraft({
      dealerCode: dealer.dealerCode,
      amount,
      effectiveDate,
      remarks: remarks || undefined,
    });

    setSubmitting(false);
    if (!result.success) {
      setError(t(result.error.messageKey));
      return;
    }
    setDraft(result.data);
    setStep("validation");
    void runValidation(result.data.id);
  };

  const runValidation = async (id: string) => {
    setSubmitting(true);
    setError(null);
    setValidationIssues([]);

    const result = await validateOpeningBalance({ id });
    setSubmitting(false);

    if (!result.success) {
      setError(t(result.error.messageKey));
      return;
    }
    if (!result.data.valid) {
      setValidationIssues(result.data.issues);
      return;
    }
    if (result.data.openingBalance) {
      setDraft(result.data.openingBalance);
    }
    setStep("confirmation");
  };

  const handlePost = async () => {
    if (!draft) return;
    setStep("posting");
    setSubmitting(true);
    setError(null);

    const result = await postOpeningBalance({ id: draft.id });
    setSubmitting(false);

    if (!result.success) {
      setError(t(result.error.messageKey));
      setStep("confirmation");
      return;
    }
    setDraft(result.data.openingBalance);
    setStep("success");
  };

  if (resolving) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white py-24 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WizardStepper currentIndex={stepIndex} />

      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-rose-200/80 bg-rose-50/50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400"
        >
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </p>
      )}

      {step === "dealer" && (
        <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("openingBalance.wizard.step.dealer")}
          </h2>
          <UninitializedDealersTable onSelect={handleDealerSelect} />
        </section>
      )}

      {step === "entry" && dealer && (
        <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("openingBalance.wizard.step.entry")}
          </h2>
          <DealerBanner dealer={dealer} />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t("openingBalance.field.amount")}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {t("openingBalance.field.amountHint")}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t("openingBalance.field.effectiveDate")}
              </label>
              <input
                type="date"
                value={effectiveDate}
                max={today}
                onChange={(event) => setEffectiveDate(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t("openingBalance.field.remarks")}
              </label>
              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                rows={2}
                maxLength={500}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            {!initialDealerCode ? (
              <button
                type="button"
                onClick={() => setStep("dealer")}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                {t("openingBalance.actions.backToDealerSelection")}
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleCreateDraft()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {submitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
              {t("openingBalance.actions.continueToValidation")}
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </section>
      )}

      {step === "validation" && (
        <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("openingBalance.wizard.step.validation")}
          </h2>
          {submitting ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              {t("openingBalance.wizard.validating")}
            </div>
          ) : validationIssues.length > 0 ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-rose-600 dark:text-rose-400">
                <AlertTriangle aria-hidden="true" className="size-4" />
                {t("openingBalance.wizard.validationFailed")}
              </p>
              <ul className="space-y-1 rounded-lg border border-rose-200/80 bg-rose-50/50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400">
                {validationIssues.map((issue, index) => (
                  <li key={`${issue.field}-${index}`}>{t(issue.messageKey)}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setStep("entry")}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                {t("openingBalance.actions.backToEntry")}
              </button>
            </div>
          ) : null}
        </section>
      )}

      {step === "confirmation" && draft && dealer && (
        <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <ShieldCheck aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" />
            {t("openingBalance.wizard.step.confirmation")}
          </h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            {t("openingBalance.wizard.confirmationHint")}
          </p>

          <SummaryTable dealer={dealer} draft={draft} formatMoney={formatMoney} />

          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep("entry")}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50 dark:text-slate-400"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {t("openingBalance.actions.backToEntry")}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handlePost()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
            >
              <Check aria-hidden="true" className="size-4" />
              {t("openingBalance.actions.confirmAndPost")}
            </button>
          </div>
        </section>
      )}

      {step === "posting" && (
        <section className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200/80 bg-white py-16 text-center dark:border-slate-800 dark:bg-slate-900">
          <Loader2 aria-hidden="true" className="size-6 animate-spin text-slate-400" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {t("openingBalance.wizard.posting")}
          </p>
        </section>
      )}

      {step === "success" && draft && dealer && (
        <section className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-6 text-center dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
            <CheckCircle2 aria-hidden="true" className="size-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            {t("openingBalance.wizard.successTitle")}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("openingBalance.wizard.successDescription")
              .replace("{dealer}", dealer.companyName)
              .replace("{amount}", formatMoney(draft.amount))}
          </p>

          <div className="mx-auto mt-5 max-w-md">
            <SummaryTable dealer={dealer} draft={draft} formatMoney={formatMoney} />
          </div>

          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/opening-balances"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {t("openingBalance.actions.backToList")}
            </Link>
            <Link
              href={`/dealers/${dealer.dealerCode}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 dark:bg-white dark:text-slate-900"
            >
              {t("openingBalance.actions.viewDealer")}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function DealerBanner({ dealer }: { dealer: DealerContext }) {
  return (
    <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-800/60">
      <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
        {dealer.dealerCode}
      </span>
      <span className="text-slate-700 dark:text-slate-300">{dealer.companyName}</span>
    </div>
  );
}

function SummaryTable({
  dealer,
  draft,
  formatMoney,
}: {
  dealer: DealerContext;
  draft: OpeningBalanceDTO;
  formatMoney: (value: string) => string;
}) {
  const { t, locale } = useLanguage();
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [locale],
  );
  const isCredit = Number(draft.amount) < 0;

  const rows: Array<[string, React.ReactNode]> = [
    [t("openingBalance.column.dealerName"), `${dealer.companyName} (${dealer.dealerCode})`],
    [
      t("openingBalance.field.amount"),
      <span
        key="amount"
        className={cn(
          "font-semibold",
          isCredit
            ? "text-blue-600 dark:text-blue-400"
            : "text-slate-900 dark:text-slate-100",
        )}
      >
        {formatMoney(draft.amount)}
        <span className="ml-1.5 text-xs font-normal text-slate-400">
          {isCredit
            ? t("openingBalance.field.advanceCredit")
            : t("openingBalance.field.dealerOwes")}
        </span>
      </span>,
    ],
    [t("openingBalance.field.effectiveDate"), dateFormatter.format(new Date(draft.effectiveDate))],
    [t("openingBalance.column.status"), <OpeningBalanceStatusBadge key="status" status={draft.status} />],
  ];

  if (draft.referenceNo) {
    rows.push([t("openingBalance.field.referenceNo"), draft.referenceNo]);
  }
  if (draft.ledgerEntryId) {
    rows.push([t("openingBalance.field.ledgerEntry"), draft.ledgerEntryId]);
  }
  if (draft.remarks) {
    rows.push([t("openingBalance.field.remarks"), draft.remarks]);
  }

  return (
    <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200/80 dark:divide-slate-800 dark:border-slate-800">
      {rows.map(([label, value], index) => (
        <div key={index} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
          <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
          <dd className="text-right text-slate-900 dark:text-slate-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function WizardStepper({ currentIndex }: { currentIndex: number }) {
  const { t } = useLanguage();
  const labels = [
    "openingBalance.wizard.step.dealer",
    "openingBalance.wizard.step.entry",
    "openingBalance.wizard.step.validation",
    "openingBalance.wizard.step.confirmation",
    "openingBalance.wizard.step.posting",
    "openingBalance.wizard.step.success",
  ];

  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs font-medium">
      {labels.map((key, index) => {
        const state =
          index < currentIndex ? "done" : index === currentIndex ? "current" : "pending";
        return (
          <li key={key} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]",
                state === "done" &&
                  "bg-emerald-600 text-white dark:bg-emerald-500",
                state === "current" &&
                  "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
                state === "pending" &&
                  "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
              )}
            >
              {state === "done" ? <Check aria-hidden="true" className="size-3" /> : index + 1}
            </span>
            <span
              className={cn(
                state === "pending"
                  ? "text-slate-400 dark:text-slate-500"
                  : "text-slate-700 dark:text-slate-200",
              )}
            >
              {t(key)}
            </span>
            {index < labels.length - 1 && (
              <span aria-hidden="true" className="mx-1 h-px w-4 bg-slate-200 dark:bg-slate-700" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
