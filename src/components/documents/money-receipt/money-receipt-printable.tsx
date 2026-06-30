"use client";

import { useMemo } from "react";
import type { CollectionStatus } from "@prisma/client";

import { CompanyFooter } from "@/components/documents/branding/company-footer";
import { CompanyHeader } from "@/components/documents/branding/company-header";
import { DocumentLayout } from "@/components/documents/layout/document-layout";
import { DocumentFinancialSummary } from "@/components/documents/sections/document-financial-summary";
import type { DocumentFinancialLine } from "@/components/documents/sections/document-financial-summary";
import { DocumentMetadata } from "@/components/documents/sections/document-metadata";
import { DocumentNotes } from "@/components/documents/sections/document-notes";
import { DocumentParties } from "@/components/documents/sections/document-parties";
import { DocumentSeal } from "@/components/documents/sections/document-seal";
import { DocumentSignature } from "@/components/documents/sections/document-signature";
import { DocumentTable } from "@/components/documents/sections/document-table";
import { DocumentTitle } from "@/components/documents/sections/document-title";
import "@/components/documents/styles/document-print.css";
import { getCompanyBranding } from "@/lib/documents/company-branding";
import {
  createDocumentDateFormatter,
  createMoneyFormatter,
  formatMoney,
} from "@/lib/utils/format-money";
import type { MoneyReceiptDocumentDTO, MoneyReceiptLabels } from "@/types/document";

interface MoneyReceiptPrintableProps {
  document: MoneyReceiptDocumentDTO;
  labels: MoneyReceiptLabels;
  statusLabel: string;
  paymentMethodLabel: string;
  referenceTypeLabel: (type: string) => string;
  locale: "en" | "bn";
}

/**
 * Single source of truth for money receipt preview, browser print, and PDF output.
 * Composes reusable document platform primitives only — no duplicated markup.
 */
export function MoneyReceiptPrintable({
  document,
  labels,
  statusLabel,
  paymentMethodLabel,
  referenceTypeLabel,
  locale,
}: MoneyReceiptPrintableProps) {
  const branding = getCompanyBranding();

  const moneyFormatter = useMemo(() => createMoneyFormatter(locale), [locale]);
  const dateFormatter = useMemo(() => createDocumentDateFormatter(locale), [locale]);

  const formatMoneyValue = (value: string) => formatMoney(value, moneyFormatter);
  const formatDate = (iso: string) => dateFormatter.format(new Date(iso));

  const financialLines: DocumentFinancialLine[] = [
    {
      label: labels.receivedAmount,
      value: formatMoneyValue(document.receivedAmount),
      highlight: true,
    },
    {
      label: labels.allocatedAmount,
      value: formatMoneyValue(document.allocatedAmount),
    },
    {
      label: labels.advanceAmount,
      value: formatMoneyValue(document.unallocatedAmount),
      emphasis: true,
    },
    {
      label: labels.remainingUnallocated,
      value: formatMoneyValue(document.unallocatedAmount),
    },
    {
      label: labels.collectionStatus,
      value: statusLabel,
    },
  ];

  const metadataFields = [
    { label: labels.collectionNo, value: document.collectionNo },
    { label: labels.receiptDate, value: formatDate(document.receiptDate) },
    { label: labels.paymentMethod, value: paymentMethodLabel },
    {
      label: labels.referenceNumber,
      value: document.referenceNumber ?? "—",
    },
  ];

  const hasAllocations = document.allocations.length > 0;

  return (
    <DocumentLayout>
      <CompanyHeader branding={branding} />
      <DocumentTitle title={labels.title} />
      <DocumentMetadata
        primaryReference={document.receiptNo}
        fields={metadataFields}
        parties={
          <DocumentParties
            parties={[{ label: labels.receivedFrom, party: document.dealer }]}
          />
        }
      />

      {hasAllocations ? (
        <DocumentTable
          variant="standard"
          caption={labels.allocationTableCaption}
          rows={document.allocations}
          rowKey={(row, index) => `${row.referenceType}-${index}`}
          columns={[
            {
              key: "type",
              header: labels.columnReferenceType,
              className: "col-ref-type",
              render: (row) => referenceTypeLabel(row.referenceType),
            },
            {
              key: "ref",
              header: labels.columnReferenceNumber,
              className: "col-ref-no",
              render: (row) => row.referenceLabel ?? "—",
            },
            {
              key: "amount",
              header: labels.columnAllocatedAmount,
              align: "right",
              className: "col-ref-amount",
              render: (row) => formatMoneyValue(row.allocatedAmount),
            },
          ]}
        />
      ) : (
        <section className="document-avoid-break mb-3 rounded border border-[var(--doc-border)] bg-slate-50/80 px-3 py-2">
          <p className="text-[8.5pt] font-bold doc-blue">{labels.allocationSummary}</p>
          <p className="mt-1 text-[8pt] leading-snug text-[var(--doc-muted)]">
            {labels.advanceRetainedMessage}
          </p>
        </section>
      )}

      <div className="document-avoid-break flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {document.remarks ? (
            <DocumentNotes title={labels.remarks} text={document.remarks} />
          ) : null}
        </div>
        <div>
          <DocumentFinancialSummary lines={financialLines} />
          <DocumentSignature label={labels.authorizedSignature} />
          <DocumentSeal label={labels.companySeal} />
        </div>
      </div>
      <CompanyFooter message={labels.footerThanks} />
    </DocumentLayout>
  );
}

export function buildMoneyReceiptLabels(t: (key: string) => string): MoneyReceiptLabels {
  return {
    title: t("document.receipt.title"),
    receivedFrom: t("document.receipt.receivedFrom"),
    receiptNo: t("document.receipt.receiptNo"),
    collectionNo: t("document.receipt.collectionNo"),
    receiptDate: t("document.receipt.receiptDate"),
    paymentMethod: t("document.receipt.paymentMethod"),
    referenceNumber: t("document.receipt.referenceNumber"),
    receivedAmount: t("document.receipt.receivedAmount"),
    allocatedAmount: t("document.receipt.allocatedAmount"),
    advanceAmount: t("document.receipt.advanceAmount"),
    remainingUnallocated: t("document.receipt.remainingUnallocated"),
    collectionStatus: t("document.receipt.collectionStatus"),
    remarks: t("document.receipt.remarks"),
    authorizedSignature: t("document.receipt.authorizedSignature"),
    companySeal: t("document.receipt.companySeal"),
    footerThanks: t("document.receipt.footerThanks"),
    allocationSummary: t("document.receipt.allocationSummary"),
    columnReferenceType: t("document.receipt.column.referenceType"),
    columnReferenceNumber: t("document.receipt.column.referenceNumber"),
    columnAllocatedAmount: t("document.receipt.column.allocatedAmount"),
    advanceRetainedMessage: t("document.receipt.advanceRetainedMessage"),
    allocationTableCaption: t("document.receipt.allocationTableCaption"),
    previewTitle: t("document.receipt.previewTitle"),
    actionsTitle: t("document.receipt.actionsTitle"),
  };
}

export function collectionStatusLabel(
  status: CollectionStatus,
  t: (key: string) => string,
): string {
  return t(`collection.status.${status}`);
}

export function collectionPaymentMethodLabel(
  method: string,
  t: (key: string) => string,
): string {
  return t(`collection.paymentMethod.${method}`);
}

export function financialReferenceTypeLabel(
  type: string,
  t: (key: string) => string,
): string {
  return t(`document.receipt.referenceType.${type}`);
}
