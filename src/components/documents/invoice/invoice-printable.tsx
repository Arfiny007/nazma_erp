"use client";

import { useMemo } from "react";
import type { InvoiceStatus } from "@prisma/client";

import { CompanyFooter } from "@/components/documents/branding/company-footer";
import { CompanyHeader } from "@/components/documents/branding/company-header";
import { DocumentLayout } from "@/components/documents/layout/document-layout";
import { DocumentNotes } from "@/components/documents/sections/document-notes";
import { DocumentSignature } from "@/components/documents/sections/document-signature";
import { DocumentTitle } from "@/components/documents/sections/document-title";
import { FinancialSummary } from "@/components/documents/sections/financial-summary";
import { InvoiceMetadata } from "@/components/documents/sections/invoice-metadata";
import { PaymentTerms } from "@/components/documents/sections/payment-terms";
import { ProductTable } from "@/components/documents/sections/product-table";
import "@/components/documents/styles/document-print.css";
import { getCompanyBranding } from "@/lib/documents/company-branding";
import { mapInvoiceToDocument } from "@/lib/documents/map-invoice-document";
import {
  createDocumentDateFormatter,
  createMoneyFormatter,
  formatMoney,
} from "@/lib/utils/format-money";
import { DOCUMENT_MAX_PRODUCT_ROWS } from "@/types/document";
import type { DocumentLabels } from "@/types/document";
import type { InvoiceDetailDTO } from "@/types/invoice";
import { INVOICE_DEFAULT_DUE_DAYS } from "@/types/invoice";

interface InvoicePrintableProps {
  invoice: InvoiceDetailDTO;
  labels: DocumentLabels;
  statusLabel: string;
  locale: "en" | "bn";
}

/**
 * Single source of truth for invoice preview, browser print, and PDF output.
 * Composes reusable document engine sections only — no duplicated markup.
 */
export function InvoicePrintable({
  invoice,
  labels,
  statusLabel,
  locale,
}: InvoicePrintableProps) {
  const branding = getCompanyBranding();
  const documentData = useMemo(() => mapInvoiceToDocument(invoice), [invoice]);

  const moneyFormatter = useMemo(() => createMoneyFormatter(locale), [locale]);
  const dateFormatter = useMemo(() => createDocumentDateFormatter(locale), [locale]);
  const quantityFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
        maximumFractionDigits: 2,
      }),
    [locale],
  );

  const formatMoneyValue = (value: string) => formatMoney(value, moneyFormatter);
  const formatDate = (iso: string) => dateFormatter.format(new Date(iso));
  const formatQuantity = (value: string) => quantityFormatter.format(Number(value));
  const exceedsPageCapacity = documentData.items.length > DOCUMENT_MAX_PRODUCT_ROWS;

  return (
    <DocumentLayout>
      {exceedsPageCapacity && (
        <p
          className="no-print mb-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[8pt] text-amber-900"
          role="status"
        >
          {labels.lineTruncationWarning.replace(
            "{count}",
            String(documentData.items.length),
          )}
        </p>
      )}
      <CompanyHeader branding={branding} />
      <DocumentTitle title={labels.invoiceTitle} />
      <InvoiceMetadata
        document={documentData}
        labels={{
          billTo: labels.billTo,
          shipTo: labels.shipTo,
          invoiceNo: labels.invoiceNo,
          invoiceDate: labels.invoiceDate,
          dueDate: labels.dueDate,
          salesPerson: labels.salesPerson,
        }}
        formatDate={formatDate}
      />
      <ProductTable
        items={documentData.items}
        labels={labels}
        formatMoney={formatMoneyValue}
        formatQuantity={formatQuantity}
      />
      <div className="document-avoid-break flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <DocumentNotes title={labels.pleaseNote} text={labels.pleaseNoteText} />
          <PaymentTerms title={labels.paymentTerms} text={labels.paymentTermsText} />
        </div>
        <div>
          <FinancialSummary
            financial={documentData.financial}
            labels={labels}
            statusLabel={statusLabel}
            formatMoney={formatMoneyValue}
          />
          <DocumentSignature label={labels.accountsSignature} />
        </div>
      </div>
      <CompanyFooter message={labels.footerThanks} />
    </DocumentLayout>
  );
}

export function buildDocumentLabels(
  t: (key: string) => string,
): DocumentLabels {
  return {
    invoiceTitle: t("document.invoice.title"),
    billTo: t("document.invoice.billTo"),
    shipTo: t("document.invoice.shipTo"),
    invoiceNo: t("document.invoice.invoiceNo"),
    invoiceDate: t("document.invoice.invoiceDate"),
    dueDate: t("document.invoice.dueDate"),
    salesPerson: t("document.invoice.salesPerson"),
    columnSl: t("document.invoice.column.sl"),
    columnProductCode: t("document.invoice.column.productCode"),
    columnProductName: t("document.invoice.column.productName"),
    columnUnit: t("document.invoice.column.unit"),
    columnQty: t("document.invoice.column.qty"),
    columnUnitPrice: t("document.invoice.column.unitPrice"),
    columnDiscount: t("document.invoice.column.discount"),
    columnAmount: t("document.invoice.column.amount"),
    subtotal: t("invoice.summary.subtotal"),
    discount: t("invoice.summary.discount"),
    vat: t("invoice.summary.vat"),
    grandTotal: t("invoice.summary.grandTotal"),
    previousDue: t("invoice.summary.previousDue"),
    currentDue: t("invoice.summary.currentDue"),
    outstanding: t("document.invoice.outstanding"),
    status: t("document.invoice.status"),
    pleaseNote: t("document.invoice.pleaseNote"),
    pleaseNoteText: t("document.invoice.pleaseNoteText"),
    paymentTerms: t("document.invoice.paymentTerms"),
    paymentTermsText: t("document.invoice.paymentTermsText").replace(
      "{days}",
      String(INVOICE_DEFAULT_DUE_DAYS),
    ),
    accountsSignature: t("document.invoice.accountsSignature"),
    footerThanks: t("document.invoice.footerThanks"),
    lineTruncationWarning: t("document.invoice.lineTruncationWarning"),
    productTableCaption: t("document.invoice.productTableCaption"),
  };
}

export function invoiceStatusLabel(
  status: InvoiceStatus,
  t: (key: string) => string,
): string {
  return t(`invoice.status.${status}`);
}
