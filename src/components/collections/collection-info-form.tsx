"use client";

import { CollectionPaymentMethod } from "@prisma/client";
import { useId } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import type { CollectionDetailDTO } from "@/types/collection";

const PAYMENT_METHODS = [
  CollectionPaymentMethod.Cash,
  CollectionPaymentMethod.Bank,
  CollectionPaymentMethod.Cheque,
  CollectionPaymentMethod.MobileBanking,
  CollectionPaymentMethod.OnlineTransfer,
  CollectionPaymentMethod.Other,
] as const;

export interface CollectionFormValues {
  collectionDate: string;
  paymentMethod: CollectionPaymentMethod;
  referenceNumber: string;
  bankName: string;
  receivedAmount: string;
  remarks: string;
}

interface CollectionInfoFormProps {
  values: CollectionFormValues;
  collectionNo?: string | null;
  readOnly?: boolean;
  onChange?: (values: CollectionFormValues) => void;
}

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

export function collectionToFormValues(
  collection?: CollectionDetailDTO | null,
): CollectionFormValues {
  if (!collection) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      collectionDate: today,
      paymentMethod: CollectionPaymentMethod.Cash,
      referenceNumber: "",
      bankName: "",
      receivedAmount: "",
      remarks: "",
    };
  }

  return {
    collectionDate: toDateInputValue(collection.collectionDate),
    paymentMethod: collection.paymentMethod,
    referenceNumber: collection.referenceNumber ?? "",
    bankName: collection.bankName ?? "",
    receivedAmount: collection.receivedAmount,
    remarks: collection.remarks ?? "",
  };
}

export function CollectionInfoForm({
  values,
  collectionNo,
  readOnly = false,
  onChange,
}: CollectionInfoFormProps) {
  const { t } = useLanguage();
  const formId = useId();

  const update = <K extends keyof CollectionFormValues>(
    key: K,
    value: CollectionFormValues[K],
  ) => {
    if (readOnly || !onChange) return;
    onChange({ ...values, [key]: value });
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800/50";

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("collection.workspace.collectionInfo")}
        </h2>
      </header>

      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {collectionNo && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              {t("collection.workspace.collectionNo")}
            </label>
            <p className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
              {collectionNo}
            </p>
          </div>
        )}

        <div>
          <label htmlFor={`${formId}-date`} className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("collection.workspace.collectionDate")}
          </label>
          <input
            id={`${formId}-date`}
            type="date"
            value={values.collectionDate}
            disabled={readOnly}
            onChange={(event) => update("collectionDate", event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`${formId}-method`} className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("collection.workspace.paymentMethod")}
          </label>
          <select
            id={`${formId}-method`}
            value={values.paymentMethod}
            disabled={readOnly}
            onChange={(event) =>
              update("paymentMethod", event.target.value as CollectionPaymentMethod)
            }
            className={inputClass}
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {t(`collection.paymentMethod.${method}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${formId}-reference`} className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("collection.workspace.referenceNo")}
          </label>
          <input
            id={`${formId}-reference`}
            type="text"
            value={values.referenceNumber}
            disabled={readOnly}
            onChange={(event) => update("referenceNumber", event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`${formId}-bank`} className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("collection.workspace.bankName")}
          </label>
          <input
            id={`${formId}-bank`}
            type="text"
            value={values.bankName}
            disabled={readOnly}
            onChange={(event) => update("bankName", event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`${formId}-amount`} className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("collection.workspace.receivedAmount")}
          </label>
          <input
            id={`${formId}-amount`}
            type="text"
            inputMode="decimal"
            value={values.receivedAmount}
            disabled={readOnly}
            onChange={(event) => update("receivedAmount", event.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor={`${formId}-remarks`} className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("collection.workspace.remarks")}
          </label>
          <textarea
            id={`${formId}-remarks`}
            rows={2}
            value={values.remarks}
            disabled={readOnly}
            onChange={(event) => update("remarks", event.target.value)}
            className={inputClass}
          />
        </div>
      </div>
    </section>
  );
}
