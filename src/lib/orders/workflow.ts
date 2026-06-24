import { OrderStatus } from "@prisma/client";

import type { OrderErrorCode } from "@/types/order";

/**
 * Sales order status workflow.
 *
 * Centralizes every lifecycle transition rule so the actions never embed status
 * logic inline. Guard functions throw a typed {@link OrderWorkflowError} which
 * the action layer maps to a structured, localizable failure result.
 *
 * Business rules enforced here:
 *   - Cannot approve a cancelled order.
 *   - Cannot reject an approved order.
 *   - Cannot cancel an invoiced order.
 *
 * Approved orders remain editable (no transition occurs on edit); only a
 * cancelled order is fully locked from editing.
 */

/** The statuses this phase's workflow operates over. `Delivered` is reserved. */
export const ORDER_WORKFLOW_STATUSES = [
  OrderStatus.Draft,
  OrderStatus.Pending_Approval,
  OrderStatus.Approved,
  OrderStatus.Rejected,
  OrderStatus.Cancelled,
] as const;

/** Error raised by a workflow guard; carries a code + localization key. */
export class OrderWorkflowError extends Error {
  readonly code: OrderErrorCode;
  readonly messageKey: string;

  constructor(code: OrderErrorCode, messageKey: string) {
    super(code);
    this.name = "OrderWorkflowError";
    this.code = code;
    this.messageKey = messageKey;
  }
}

/**
 * Allowed status transitions. `updateOrder` only ever uses the
 * Draft↔Pending_Approval edges; the Approve/Reject/Cancel actions own the rest.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.Draft]: [
    OrderStatus.Pending_Approval,
    OrderStatus.Approved,
    OrderStatus.Rejected,
    OrderStatus.Cancelled,
  ],
  [OrderStatus.Pending_Approval]: [
    OrderStatus.Draft,
    OrderStatus.Approved,
    OrderStatus.Rejected,
    OrderStatus.Cancelled,
  ],
  [OrderStatus.Approved]: [OrderStatus.Cancelled],
  [OrderStatus.Partially_Delivered]: [OrderStatus.Cancelled],
  [OrderStatus.Rejected]: [
    OrderStatus.Draft,
    OrderStatus.Pending_Approval,
    OrderStatus.Approved,
    OrderStatus.Cancelled,
  ],
  [OrderStatus.Cancelled]: [],
  [OrderStatus.Delivered]: [],
};

/** Returns true when `to` is a permitted next status from `from`. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) {
    return true;
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Validates a status change requested through `updateOrder`. Only the
 * Draft↔Pending_Approval edges (plus no-op same-status) are permitted here.
 */
export function assertCanChangeStatusOnUpdate(
  from: OrderStatus,
  to: OrderStatus,
): void {
  if (from === to) {
    return;
  }

  const editableEdges: readonly OrderStatus[] =
    from === OrderStatus.Draft
      ? [OrderStatus.Pending_Approval]
      : from === OrderStatus.Pending_Approval
        ? [OrderStatus.Draft]
        : [];

  if (!editableEdges.includes(to)) {
    throw new OrderWorkflowError(
      "INVALID_STATUS_TRANSITION",
      "order.error.invalidTransition",
    );
  }
}

/** Guards that an order may be edited (line/dealer/project changes). */
export function assertEditable(current: OrderStatus): void {
  if (current === OrderStatus.Cancelled) {
    throw new OrderWorkflowError(
      "ORDER_CANCELLED",
      "order.error.cancelledImmutable",
    );
  }
  if (current === OrderStatus.Delivered) {
    throw new OrderWorkflowError("ORDER_LOCKED", "order.error.locked");
  }
  if (current === OrderStatus.Partially_Delivered) {
    throw new OrderWorkflowError("ORDER_LOCKED", "order.error.locked");
  }
}

/**
 * Guards an approval. Approvable from Draft, Pending_Approval or Rejected
 * (the latter supports Super_Admin override of a prior rejection).
 *
 * @throws ORDER_CANCELLED when the order is cancelled.
 * @throws ORDER_ALREADY_APPROVED when the order is already approved.
 */
export function assertCanApprove(current: OrderStatus): void {
  if (current === OrderStatus.Cancelled) {
    throw new OrderWorkflowError(
      "ORDER_CANCELLED",
      "order.error.cannotApproveCancelled",
    );
  }
  if (current === OrderStatus.Approved) {
    throw new OrderWorkflowError(
      "ORDER_ALREADY_APPROVED",
      "order.error.alreadyApproved",
    );
  }
  if (!canTransition(current, OrderStatus.Approved)) {
    throw new OrderWorkflowError(
      "INVALID_STATUS_TRANSITION",
      "order.error.invalidTransition",
    );
  }
}

/**
 * Guards a rejection. Rejectable from Draft or Pending_Approval only.
 *
 * @throws CANNOT_REJECT_APPROVED when the order is already approved.
 * @throws ORDER_CANCELLED when the order is cancelled.
 */
export function assertCanReject(current: OrderStatus): void {
  if (current === OrderStatus.Approved) {
    throw new OrderWorkflowError(
      "CANNOT_REJECT_APPROVED",
      "order.error.cannotRejectApproved",
    );
  }
  if (current === OrderStatus.Cancelled) {
    throw new OrderWorkflowError(
      "ORDER_CANCELLED",
      "order.error.cancelledImmutable",
    );
  }
  if (current === OrderStatus.Rejected) {
    throw new OrderWorkflowError(
      "INVALID_STATUS_TRANSITION",
      "order.error.alreadyRejected",
    );
  }
  if (!canTransition(current, OrderStatus.Rejected)) {
    throw new OrderWorkflowError(
      "INVALID_STATUS_TRANSITION",
      "order.error.invalidTransition",
    );
  }
}

/**
 * Guards a cancellation. Cancellable from any non-terminal status provided the
 * order has not generated any invoices or confirmed delivery challans.
 *
 * @throws ORDER_INVOICED when the order already has invoices or dispatches.
 * @throws ORDER_CANCELLED when the order is already cancelled.
 */
export function assertCanCancel(
  current: OrderStatus,
  invoiceCount: number,
  confirmedChallanCount = 0,
): void {
  if (invoiceCount > 0 || confirmedChallanCount > 0) {
    throw new OrderWorkflowError("ORDER_INVOICED", "order.error.invoiced");
  }
  if (current === OrderStatus.Cancelled) {
    throw new OrderWorkflowError(
      "INVALID_STATUS_TRANSITION",
      "order.error.alreadyCancelled",
    );
  }
  if (!canTransition(current, OrderStatus.Cancelled)) {
    throw new OrderWorkflowError(
      "INVALID_STATUS_TRANSITION",
      "order.error.invalidTransition",
    );
  }
}
