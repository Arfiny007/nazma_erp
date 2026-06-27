import type { InvoiceStatus } from "@prisma/client";

/**
 * Domain types for the Invoice Engine module.
 *
 * Invoices are FINANCIAL documents issued from Confirmed Delivery Challans.
 * Every invoice requires immutable {@link InvoiceItemDTO} line snapshots.
 *
 * Monetary values are exposed as fixed-precision decimal strings for safe
 * Server/Client transport. See ADR-014.
 */

export type { InvoiceStatus };

/* -------------------------------------------------------------------------- */
/*                          Data transfer / view models                      */
/* -------------------------------------------------------------------------- */

/** Immutable invoice line snapshot — never recomputed after issue. */
export interface InvoiceItemDTO {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  lineTotal: string;
  orderItemId: string | null;
  challanItemId: string | null;
}

/** Row-level projection used by the invoice listing backend. */
export interface InvoiceSummaryDTO {
  id: string;
  invoiceNo: string;
  dealerCode: string;
  dealerName: string;
  orderId: string;
  orderNo: string;
  deliveryChallanId: string | null;
  challanNo: string | null;
  status: InvoiceStatus;
  subtotal: string;
  discount: string;
  vat: string;
  grandTotal: string;
  previousDue: string;
  currentDue: string;
  collectionReceived: string;
  /** Outstanding balance on this invoice (currentDue − collectionReceived). */
  outstanding: string;
  issueDate: string;
  dueDate: string;
  createdAt: string;
}

/** Full invoice projection including immutable line items. */
export interface InvoiceDetailDTO extends InvoiceSummaryDTO {
  items: InvoiceItemDTO[];
  deliveryMode: string;
  vehicleNo: string | null;
  driverName: string | null;
  /** Dealer contact snapshot for printable documents. */
  dealerAddress: string;
  dealerMobile: string;
  dealerEmail: string | null;
  /** Optional sales representative label for document metadata. */
  salesPerson: string | null;
  /** Audit-derived lifecycle history for the invoice detail page. */
  auditHistory: InvoiceHistoryDTO[];
}

/**
 * One entry in an invoice's audit trail, derived from persisted {@link AuditLog}
 * records for the invoice entity.
 */
export interface InvoiceHistoryDTO {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  remarks: string | null;
  timestamp: string;
}

/** Line in a pre-issue financial preview (server-computed). */
export interface InvoicePreviewLineDTO {
  productCode: string;
  productName: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  lineTotal: string;
}

/** Pre-issue financial preview from a confirmed delivery challan. */
export interface InvoicePreviewDTO {
  challanId: string;
  challanNo: string;
  orderId: string;
  orderNo: string;
  dealerCode: string;
  dealerName: string;
  subtotal: string;
  discount: string;
  vat: string;
  grandTotal: string;
  previousDue: string;
  currentDue: string;
  lines: InvoicePreviewLineDTO[];
}

/** Summary row for invoice-eligible confirmed challans. */
export interface InvoiceEligibleChallanDTO {
  id: string;
  challanNo: string;
  orderId: string;
  orderNo: string;
  dealerCode: string;
  dealerName: string;
  itemCount: number;
  totalQuantity: string;
  dispatchedAt: string | null;
}

/* -------------------------------------------------------------------------- */
/*                              Listing & paging                              */
/* -------------------------------------------------------------------------- */

export const INVOICE_SORT_FIELDS = [
  "invoiceNo",
  "status",
  "issueDate",
  "dueDate",
  "grandTotal",
  "createdAt",
] as const;

export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number];

export type SortOrder = "asc" | "desc";

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/* -------------------------------------------------------------------------- */
/*                            Typed error responses                           */
/* -------------------------------------------------------------------------- */

export type InvoiceErrorCode =
  | "VALIDATION_ERROR"
  | "INVOICE_NOT_FOUND"
  | "CHALLAN_NOT_FOUND"
  | "CHALLAN_NOT_CONFIRMED"
  | "CHALLAN_CANCELLED"
  | "CHALLAN_EMPTY"
  | "INVOICE_ALREADY_EXISTS"
  | "CREDIT_LIMIT_EXCEEDED"
  | "DUPLICATE_INVOICE_NO"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

export interface FieldError {
  field: string;
  messageKey: string;
}

export interface InvoiceError {
  code: InvoiceErrorCode;
  messageKey: string;
  fieldErrors?: FieldError[];
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: InvoiceError };

/** Default payment terms when issuing an invoice (days after issue date). */
export const INVOICE_DEFAULT_DUE_DAYS = 30;
