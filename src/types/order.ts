import type { OrderStatus } from "@prisma/client";

/**
 * Domain types for the Sales Order module.
 *
 * Prisma's `Decimal` type is not serializable across the Server/Client
 * boundary, so every monetary value that leaves the data layer is exposed as a
 * fixed-precision decimal string (e.g. "12500.00"). Quantities are likewise
 * exposed as decimal strings. UI code is responsible for locale-aware
 * formatting of these strings.
 */

export type { OrderStatus };

/* -------------------------------------------------------------------------- */
/*                          Data transfer / view models                      */
/* -------------------------------------------------------------------------- */

/** A single order line, serialized for transport. */
export interface OrderItemDTO {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productModelNumber: string;
  unit: string;
  /** Ordered quantity as a fixed-precision decimal string. */
  quantity: string;
  /** Unit price captured at order time as a decimal string. */
  unitPrice: string;
  /** Per-line discount amount as a decimal string. */
  discount: string;
  /** Line total (`quantity * unitPrice - discount`) as a decimal string. */
  total: string;
}

/** A lightweight reference to a user involved in an order. */
export interface OrderActorDTO {
  id: string;
  name: string;
}

/** A lightweight reference to the project an order belongs to. */
export interface OrderProjectDTO {
  id: string;
  projectCode: string;
  name: string;
}

/**
 * One entry in an order's approval / lifecycle audit trail, derived from the
 * persisted {@link AuditLog} records for the order.
 */
export interface ApprovalHistoryDTO {
  id: string;
  /** Lifecycle action: CREATE | SUBMIT | UPDATE | APPROVE | REJECT | CANCEL. */
  action: string;
  actorId: string;
  actorName: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  remarks: string | null;
  /** ISO-8601 timestamp of the action. */
  timestamp: string;
}

/** Row-level projection used by the order listing / search backend. */
export interface OrderSummaryDTO {
  id: string;
  orderNo: string;
  dealerCode: string;
  dealerName: string;
  projectId: string | null;
  projectName: string | null;
  status: OrderStatus;
  subtotal: string;
  discount: string;
  vat: string;
  grandTotal: string;
  itemCount: number;
  /** Number of invoices generated from this order (one order → many invoices). */
  invoiceCount: number;
  createdById: string | null;
  /** Display name of the user who created the order, when available. */
  createdByName: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Full order projection including line items and approval history. */
export interface OrderDetailDTO extends OrderSummaryDTO {
  dealer: {
    dealerCode: string;
    companyName: string;
  };
  project: OrderProjectDTO | null;
  createdBy: OrderActorDTO | null;
  approvedBy: OrderActorDTO | null;
  items: OrderItemDTO[];
  approvalHistory: ApprovalHistoryDTO[];
}

/* -------------------------------------------------------------------------- */
/*                              Listing & paging                              */
/* -------------------------------------------------------------------------- */

export const ORDER_SORT_FIELDS = [
  "orderNo",
  "status",
  "grandTotal",
  "createdAt",
  "updatedAt",
] as const;

export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

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

export type OrderErrorCode =
  | "VALIDATION_ERROR"
  | "ORDER_NOT_FOUND"
  | "DEALER_NOT_FOUND"
  | "INACTIVE_DEALER"
  | "PRODUCT_NOT_FOUND"
  | "INACTIVE_PRODUCT"
  | "PROJECT_NOT_FOUND"
  | "DUPLICATE_PROJECT"
  | "DUPLICATE_ORDER_NO"
  | "EMPTY_ORDER"
  | "INVALID_STATUS_TRANSITION"
  | "ORDER_CANCELLED"
  | "ORDER_ALREADY_APPROVED"
  | "CANNOT_REJECT_APPROVED"
  | "ORDER_INVOICED"
  | "ORDER_LOCKED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

/** A single field-level validation failure carrying a localization key. */
export interface FieldError {
  field: string;
  messageKey: string;
}

/**
 * Typed, serializable error envelope. `messageKey` is always a localization
 * key (never a hard-coded human string) so the UI layer can translate it.
 */
export interface OrderError {
  code: OrderErrorCode;
  messageKey: string;
  fieldErrors?: FieldError[];
}

/** Discriminated union returned by every order server action. */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: OrderError };

/* -------------------------------------------------------------------------- */
/*                          Live financial preview                            */
/* -------------------------------------------------------------------------- */

/**
 * A single computed line in a live order-total preview. All amounts are
 * fixed-precision decimal strings produced by the backend calculation engine.
 */
export interface OrderLinePreviewDTO {
  /** `quantity * unitPrice`, rounded to 2 dp. */
  lineSubtotal: string;
  /** Per-line discount amount derived from the order-level percentage. */
  discount: string;
  /** `lineSubtotal - discount`, rounded to 2 dp. */
  total: string;
}

/**
 * Result of the live financial preview. The per-line `discount` amounts are
 * authoritative and are submitted verbatim to the create/update actions, so the
 * client never performs monetary arithmetic itself.
 */
export interface OrderTotalsPreviewDTO {
  lines: OrderLinePreviewDTO[];
  subtotal: string;
  /** Order-level discount percentage echoed back, normalized to 2 dp. */
  discountPercent: string;
  discountAmount: string;
  vat: string;
  grandTotal: string;
}
