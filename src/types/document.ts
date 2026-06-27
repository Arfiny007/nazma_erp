import type { InvoiceStatus } from "@prisma/client";

import type { InvoiceItemDTO } from "@/types/invoice";

/** Maximum product rows on a single A4 invoice page. */
export const DOCUMENT_MAX_PRODUCT_ROWS = 20;

/** Party block for Bill To / Ship To sections. */
export interface DocumentPartyDTO {
  name: string;
  address: string;
  phone: string;
  email?: string | null;
}

/** Immutable line row for document product tables. */
export interface DocumentProductRowDTO {
  serial: number;
  productCode: string;
  productName: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  amount: string;
}

/** Backend-sourced financial block — never recomputed in React. */
export interface DocumentFinancialDTO {
  subtotal: string;
  discount: string;
  vat: string;
  grandTotal: string;
  previousDue: string;
  currentDue: string;
  outstanding: string;
  status: InvoiceStatus;
}

/** Full invoice payload for the shared document engine. */
export interface InvoiceDocumentDTO {
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  salesPerson?: string | null;
  billTo: DocumentPartyDTO;
  shipTo: DocumentPartyDTO;
  items: InvoiceItemDTO[];
  financial: DocumentFinancialDTO;
}

export interface DocumentLabels {
  invoiceTitle: string;
  billTo: string;
  shipTo: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  salesPerson: string;
  columnSl: string;
  columnProductCode: string;
  columnProductName: string;
  columnUnit: string;
  columnQty: string;
  columnUnitPrice: string;
  columnDiscount: string;
  columnAmount: string;
  subtotal: string;
  discount: string;
  vat: string;
  grandTotal: string;
  previousDue: string;
  currentDue: string;
  outstanding: string;
  status: string;
  pleaseNote: string;
  pleaseNoteText: string;
  paymentTerms: string;
  paymentTermsText: string;
  accountsSignature: string;
  footerThanks: string;
  lineTruncationWarning: string;
  productTableCaption: string;
}
