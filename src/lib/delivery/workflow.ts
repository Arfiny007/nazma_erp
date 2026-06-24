import { OrderStatus, Prisma } from "@prisma/client";

import type {
  DeliveryChallanErrorCode,
  DeliveryChallanStatus,
  OrderLineFulfillmentDTO,
  OrderLineQuantitySnapshot,
} from "@/types/delivery-challan";

/**
 * Delivery Challan workflow and quantity reconciliation rules.
 *
 * Centralizes every fulfillment guard so server actions never embed business
 * logic inline. Guards throw a typed {@link DeliveryWorkflowError} which the
 * action layer maps to a structured, localizable failure result.
 *
 * NON-FINANCIAL BOUNDARY: this module must never import or call ledger,
 * balance, due, collection, or credit-limit services.
 *
 * See ADR-011 (architecture) and ADR-012 (backend design).
 */

/** Error raised by a delivery workflow guard. */
export class DeliveryWorkflowError extends Error {
  readonly code: DeliveryChallanErrorCode;
  readonly messageKey: string;
  readonly field?: string;

  constructor(
    code: DeliveryChallanErrorCode,
    messageKey: string,
    field?: string,
  ) {
    super(code);
    this.name = "DeliveryWorkflowError";
    this.code = code;
    this.messageKey = messageKey;
    this.field = field;
  }
}

/* -------------------------------------------------------------------------- */
/*                           Decimal quantity helpers                         */
/* -------------------------------------------------------------------------- */

export type DecimalLike = Prisma.Decimal | string | number;

const ZERO = new Prisma.Decimal(0);
const QUANTITY_SCALE = 2;
const ROUNDING = Prisma.Decimal.ROUND_HALF_UP;

function toDecimal(value: DecimalLike): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function quantity(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(QUANTITY_SCALE, ROUNDING);
}

/**
 * Display remaining quantity: `ordered − confirmed`, clamped at zero.
 * Draft challans do not reduce remaining qty (ADR-012 §3a).
 */
export function computeRemainingQuantity(
  orderedQuantity: DecimalLike,
  confirmedDeliveredQuantity: DecimalLike,
): Prisma.Decimal {
  const remaining = quantity(
    toDecimal(orderedQuantity).minus(toDecimal(confirmedDeliveredQuantity)),
  );
  return remaining.lessThan(ZERO) ? ZERO : remaining;
}

/**
 * Validation allocatable quantity: `ordered − confirmed − draft`, clamped at
 * zero. Used by over-delivery guards on create / update / confirm.
 */
export function computeAllocatableQuantity(
  orderedQuantity: DecimalLike,
  confirmedDeliveredQuantity: DecimalLike,
  draftDeliveredQuantity: DecimalLike = 0,
): Prisma.Decimal {
  const allocatable = quantity(
    toDecimal(orderedQuantity)
      .minus(toDecimal(confirmedDeliveredQuantity))
      .minus(toDecimal(draftDeliveredQuantity)),
  );
  return allocatable.lessThan(ZERO) ? ZERO : allocatable;
}

/**
 * Derives a per-line fulfillment DTO from an order-line snapshot.
 * Only **Confirmed** challan quantities count toward `deliveredQuantity`.
 */
export function toOrderLineFulfillment(
  snapshot: OrderLineQuantitySnapshot & {
    productName: string;
    productSku: string;
  },
): OrderLineFulfillmentDTO {
  const ordered = quantity(toDecimal(snapshot.orderedQuantity));
  const delivered = quantity(toDecimal(snapshot.confirmedDeliveredQuantity));
  const remaining = computeRemainingQuantity(ordered, delivered);

  return {
    orderItemId: snapshot.orderItemId,
    productId: snapshot.productId,
    productName: snapshot.productName,
    productSku: snapshot.productSku,
    orderedQuantity: ordered.toFixed(QUANTITY_SCALE),
    deliveredQuantity: delivered.toFixed(QUANTITY_SCALE),
    remainingQuantity: remaining.toFixed(QUANTITY_SCALE),
    isFullyDelivered: remaining.equals(ZERO),
  };
}

/* -------------------------------------------------------------------------- */
/*                          Order eligibility guards                          */
/* -------------------------------------------------------------------------- */

const CHALLAN_ELIGIBLE_STATUSES: readonly OrderStatus[] = [
  OrderStatus.Approved,
  OrderStatus.Partially_Delivered,
];

/**
 * Guards challan creation. Only approved (or partially delivered) orders may
 * receive delivery challans.
 *
 * @throws ORDER_NOT_APPROVED — order is Draft or Pending_Approval.
 * @throws ORDER_CANCELLED — order is Cancelled.
 * @throws ORDER_REJECTED — order is Rejected.
 */
export function assertCanCreateChallan(orderStatus: OrderStatus): void {
  if (orderStatus === OrderStatus.Cancelled) {
    throw new DeliveryWorkflowError(
      "ORDER_CANCELLED",
      "challan.error.orderCancelled",
    );
  }
  if (orderStatus === OrderStatus.Rejected) {
    throw new DeliveryWorkflowError(
      "ORDER_REJECTED",
      "challan.error.orderRejected",
    );
  }
  if (orderStatus === OrderStatus.Delivered) {
    throw new DeliveryWorkflowError(
      "ORDER_NOT_APPROVED",
      "challan.error.orderFullyDelivered",
    );
  }
  if (!CHALLAN_ELIGIBLE_STATUSES.includes(orderStatus)) {
    throw new DeliveryWorkflowError(
      "ORDER_NOT_APPROVED",
      "challan.error.orderNotApproved",
    );
  }
}

/**
 * Guards order line edits. Blocked after the first **Confirmed** challan
 * (ADR-012 §6 — Draft challans do not lock the commercial order).
 *
 * @throws ORDER_LINES_LOCKED when `confirmedChallanCount > 0`.
 */
export function assertOrderLinesMutable(confirmedChallanCount: number): void {
  if (confirmedChallanCount > 0) {
    throw new DeliveryWorkflowError(
      "ORDER_LINES_LOCKED",
      "challan.error.orderLinesLocked",
    );
  }
}

/**
 * Guards order header edits (dealer / project). Same trigger as line immutability.
 */
export function assertOrderHeaderMutable(confirmedChallanCount: number): void {
  assertOrderLinesMutable(confirmedChallanCount);
}

/* -------------------------------------------------------------------------- */
/*                         Over-delivery prevention                           */
/* -------------------------------------------------------------------------- */

export interface ChallanLineRequest {
  orderItemId: string;
  quantity: DecimalLike;
}

/**
 * Validates that requested challan line quantities do not exceed allocatable
 * capacity on the parent order.
 *
 * @throws ORDER_ITEM_NOT_FOUND when a requested line is not on the order.
 * @throws OVER_DELIVERY when any line exceeds allocatable qty.
 */
export function assertNotOverDelivery(
  orderLines: readonly OrderLineQuantitySnapshot[],
  requestedLines: readonly ChallanLineRequest[],
): void {
  const lineById = new Map(
    orderLines.map((line) => [line.orderItemId, line]),
  );

  const aggregatedRequest = new Map<string, Prisma.Decimal>();
  for (const request of requestedLines) {
    const current = aggregatedRequest.get(request.orderItemId) ?? ZERO;
    aggregatedRequest.set(
      request.orderItemId,
      current.plus(toDecimal(request.quantity)),
    );
  }

  for (const [orderItemId, requestedQty] of aggregatedRequest) {
    const orderLine = lineById.get(orderItemId);
    if (!orderLine) {
      throw new DeliveryWorkflowError(
        "ORDER_ITEM_NOT_FOUND",
        "challan.error.orderItemNotFound",
        orderItemId,
      );
    }

    const allocatable = computeAllocatableQuantity(
      orderLine.orderedQuantity,
      orderLine.confirmedDeliveredQuantity,
      orderLine.draftDeliveredQuantity,
    );

    if (quantity(requestedQty).greaterThan(allocatable)) {
      throw new DeliveryWorkflowError(
        "OVER_DELIVERY",
        "challan.error.overDelivery",
        orderItemId,
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                        Challan lifecycle guards                            */
/* -------------------------------------------------------------------------- */

const CONFIRM_ALLOWED_FROM: readonly DeliveryChallanStatus[] = ["Draft"];

/**
 * Guards challan confirmation (dispatch). Only Draft challans may be confirmed.
 *
 * @throws CHALLAN_ALREADY_CONFIRMED — challan is already Confirmed.
 * @throws CHALLAN_CANCELLED — challan is Cancelled.
 */
export function assertCanConfirmChallan(status: DeliveryChallanStatus): void {
  if (status === "Confirmed") {
    throw new DeliveryWorkflowError(
      "CHALLAN_ALREADY_CONFIRMED",
      "challan.error.alreadyConfirmed",
    );
  }
  if (status === "Cancelled") {
    throw new DeliveryWorkflowError(
      "CHALLAN_CANCELLED",
      "challan.error.cancelled",
    );
  }
  if (!CONFIRM_ALLOWED_FROM.includes(status)) {
    throw new DeliveryWorkflowError(
      "INVALID_STATUS_TRANSITION",
      "challan.error.invalidTransition",
    );
  }
}

/** Only Draft challans may be edited. */
export function assertCanUpdateChallan(status: DeliveryChallanStatus): void {
  if (status === "Confirmed") {
    throw new DeliveryWorkflowError(
      "CHALLAN_ALREADY_CONFIRMED",
      "challan.error.alreadyConfirmed",
    );
  }
  if (status === "Cancelled") {
    throw new DeliveryWorkflowError(
      "CHALLAN_CANCELLED",
      "challan.error.cancelled",
    );
  }
}

/** Only Draft challans may be cancelled. */
export function assertCanCancelChallan(status: DeliveryChallanStatus): void {
  if (status === "Confirmed") {
    throw new DeliveryWorkflowError(
      "CHALLAN_ALREADY_CONFIRMED",
      "challan.error.cannotCancelConfirmed",
    );
  }
  if (status === "Cancelled") {
    throw new DeliveryWorkflowError(
      "CHALLAN_CANCELLED",
      "challan.error.alreadyCancelled",
    );
  }
}

/** Rejects challan creation when the items array would be empty after validation. */
export function assertChallanHasItems(itemCount: number): void {
  if (itemCount < 1) {
    throw new DeliveryWorkflowError("CHALLAN_EMPTY", "challan.error.empty");
  }
}

/* -------------------------------------------------------------------------- */
/*                      Order completion detection                            */
/* -------------------------------------------------------------------------- */

/**
 * Returns true when every order line has zero remaining quantity
 * (all ordered quantities have been confirmed on challans).
 */
export function isOrderFullyDelivered(
  lines: readonly OrderLineFulfillmentDTO[],
): boolean {
  if (lines.length === 0) {
    return false;
  }
  return lines.every((line) => line.isFullyDelivered);
}

/**
 * Returns true when at least one line has confirmed delivery progress but the
 * order is not yet fully delivered.
 */
export function isOrderPartiallyDelivered(
  lines: readonly OrderLineFulfillmentDTO[],
): boolean {
  const anyDelivered = lines.some(
    (line) => !toDecimal(line.deliveredQuantity).equals(ZERO),
  );
  return anyDelivered && !isOrderFullyDelivered(lines);
}

/**
 * Determines the order status transition after a challan is confirmed.
 * Approved → Partially_Delivered → Delivered based on confirmed quantities only.
 */
export function resolveOrderStatusAfterDelivery(
  currentStatus: OrderStatus,
  fulfillmentLines: readonly OrderLineFulfillmentDTO[],
): OrderStatus {
  const eligible: readonly OrderStatus[] = [
    OrderStatus.Approved,
    OrderStatus.Partially_Delivered,
  ];
  if (!eligible.includes(currentStatus)) {
    return currentStatus;
  }
  if (isOrderFullyDelivered(fulfillmentLines)) {
    return OrderStatus.Delivered;
  }
  if (isOrderPartiallyDelivered(fulfillmentLines)) {
    return OrderStatus.Partially_Delivered;
  }
  return currentStatus;
}
