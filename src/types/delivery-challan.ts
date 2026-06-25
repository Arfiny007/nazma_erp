/**
 * Domain types for the Delivery Challan module.
 *
 * Delivery Challans are NON-FINANCIAL logistics documents that record physical
 * shipment between an approved Sales Order and a future Invoice (PHASE_05C).
 *
 * Prisma's `Decimal` type is not serializable across the Server/Client
 * boundary, so quantities are exposed as fixed-precision decimal strings.
 * See ADR-011 and ADR-012.
 */

/* -------------------------------------------------------------------------- */
/*                              Lifecycle status                              */
/* -------------------------------------------------------------------------- */

/**
 * Challan lifecycle statuses. Will map 1:1 to a Prisma enum when the schema
 * migration runs (deferred — see ADR-012).
 */
export const DELIVERY_CHALLAN_STATUSES = [
  "Draft",
  "Confirmed",
  "Cancelled",
] as const;

export type DeliveryChallanStatus = (typeof DELIVERY_CHALLAN_STATUSES)[number];

/** Terminal statuses — no further quantity or logistics edits permitted. */
export const TERMINAL_CHALLAN_STATUSES = [
  "Confirmed",
  "Cancelled",
] as const satisfies readonly DeliveryChallanStatus[];

/* -------------------------------------------------------------------------- */
/*                          Data transfer / view models                      */
/* -------------------------------------------------------------------------- */

/** A single challan line, serialized for transport. */
export interface DeliveryChallanItemDTO {
  id: string;
  orderItemId: string;
  productId: string;
  productName: string;
  productSku: string;
  productModelNumber: string;
  unit: string;
  /** Quantity shipped on this challan as a fixed-precision decimal string. */
  quantity: string;
}

/** Row-level projection used by the challan listing backend. */
export interface DeliveryChallanSummaryDTO {
  id: string;
  challanNo: string;
  orderId: string;
  orderNo: string;
  dealerCode: string;
  dealerName: string;
  status: DeliveryChallanStatus;
  deliveryMode: string;
  vehicleNo: string | null;
  driverName: string | null;
  itemCount: number;
  /** Sum of line quantities on this challan. */
  totalQuantity: string;
  /** Whether an invoice has been generated from this challan (PHASE_05C). */
  hasInvoice: boolean;
  dispatchedAt: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Full challan projection including line items. */
export interface DeliveryChallanDetailDTO extends DeliveryChallanSummaryDTO {
  items: DeliveryChallanItemDTO[];
  remarks: string | null;
  confirmedById: string | null;
  confirmedByName: string | null;
  /** Audit-derived lifecycle history for the challan detail page. */
  auditHistory: ChallanHistoryDTO[];
}

/**
 * One entry in a challan's audit trail, derived from persisted {@link AuditLog}
 * records for the delivery challan entity.
 */
export interface ChallanHistoryDTO {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  fromStatus: DeliveryChallanStatus | null;
  toStatus: DeliveryChallanStatus | null;
  remarks: string | null;
  timestamp: string;
}

/**
 * Per-line context for create / edit challan forms. Quantities are derived
 * server-side; the UI must not recompute allocatable capacity.
 */
export interface OrderChallanLineContextDTO {
  orderItemId: string;
  productId: string;
  productName: string;
  productSku: string;
  productModelNumber: string;
  unit: string;
  orderedQuantity: string;
  /** Sum of quantities on Confirmed challans for this line. */
  deliveredQuantity: string;
  /** Sum of quantities on other Draft challans (excludes current challan when editing). */
  draftQuantity: string;
  /** Display remaining: `ordered − confirmed`, clamped ≥ 0. */
  remainingQuantity: string;
  /** Validation cap: `ordered − confirmed − draft`, clamped ≥ 0. */
  allocatableQuantity: string;
  /** `(delivered ÷ ordered) × 100`, 2 dp. */
  deliveryPercent: string;
}

/** Order header + line context for challan create / edit forms. */
export interface OrderChallanContextDTO {
  orderId: string;
  orderNo: string;
  dealerCode: string;
  dealerName: string;
  status: string;
  lines: OrderChallanLineContextDTO[];
  fulfillment: OrderFulfillmentProgressDTO;
}

/** Enriched line for the challan detail product table. */
export interface ChallanDetailLineDTO {
  orderItemId: string;
  productId: string;
  productName: string;
  productSku: string;
  productModelNumber: string;
  unit: string;
  orderedQuantity: string;
  deliveredPreviously: string;
  currentDelivery: string;
  remainingQuantity: string;
  deliveryPercent: string;
}

/**
 * Per-order-line fulfillment progress. `deliveredQuantity` and
 * `remainingQuantity` are derived at read time — never persisted.
 */
export interface OrderLineFulfillmentDTO {
  orderItemId: string;
  productId: string;
  productName: string;
  productSku: string;
  /** Ordered quantity from `SalesOrderItem.quantity`. */
  orderedQuantity: string;
  /**
   * Sum of quantities on **Confirmed** challan lines for this order item.
   * Draft challans do not count toward delivery progress.
   */
  deliveredQuantity: string;
  /** `orderedQuantity − deliveredQuantity`, clamped at zero. */
  remainingQuantity: string;
  /** True when `remainingQuantity` is exactly zero. */
  isFullyDelivered: boolean;
}

/** Aggregated fulfillment state for an order, attachable to Order Detail DTOs. */
export interface OrderFulfillmentProgressDTO {
  orderId: string;
  lines: OrderLineFulfillmentDTO[];
  /** True when every line has `remainingQuantity === 0`. */
  isFullyDelivered: boolean;
  /** True when at least one line has `deliveredQuantity > 0` but not all lines are complete. */
  isPartiallyDelivered: boolean;
  /** Count of all challans (any status) linked to the order. */
  challanCount: number;
  /** Count of Confirmed challans. */
  confirmedChallanCount: number;
}

/* -------------------------------------------------------------------------- */
/*                              Listing & paging                              */
/* -------------------------------------------------------------------------- */

export const DELIVERY_CHALLAN_SORT_FIELDS = [
  "challanNo",
  "status",
  "createdAt",
  "dispatchedAt",
] as const;

export type DeliveryChallanSortField =
  (typeof DELIVERY_CHALLAN_SORT_FIELDS)[number];

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

export type DeliveryChallanErrorCode =
  | "VALIDATION_ERROR"
  | "CHALLAN_NOT_FOUND"
  | "ORDER_NOT_FOUND"
  | "ORDER_ITEM_NOT_FOUND"
  | "ORDER_NOT_APPROVED"
  | "ORDER_CANCELLED"
  | "ORDER_REJECTED"
  | "ORDER_LINES_LOCKED"
  | "CHALLAN_ALREADY_CONFIRMED"
  | "CHALLAN_CANCELLED"
  | "CHALLAN_EMPTY"
  | "OVER_DELIVERY"
  | "DUPLICATE_CHALLAN_NO"
  | "INVALID_STATUS_TRANSITION"
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
export interface DeliveryChallanError {
  code: DeliveryChallanErrorCode;
  messageKey: string;
  fieldErrors?: FieldError[];
}

/** Discriminated union returned by every delivery challan server action. */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: DeliveryChallanError };

/* -------------------------------------------------------------------------- */
/*                         Quantity reconciliation input                      */
/* -------------------------------------------------------------------------- */

/**
 * Minimal per-line snapshot fed to workflow guards and quantity reconciliation.
 * Used by server actions when validating create/confirm operations.
 */
export interface OrderLineQuantitySnapshot {
  orderItemId: string;
  productId: string;
  orderedQuantity: string;
  /** Sum of quantities on Confirmed challans for this order item. */
  confirmedDeliveredQuantity: string;
  /** Sum of quantities on Draft challans for this order item (in-flight). */
  draftDeliveredQuantity: string;
}
