import {
  DeliveryChallanStatus,
  OrderStatus,
  Prisma,
} from "@prisma/client";
import type { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import {
  toOrderLineFulfillment,
  resolveOrderStatusAfterDelivery,
  type ChallanLineRequest,
} from "@/lib/delivery/workflow";
import type {
  ActionResult,
  ChallanHistoryDTO,
  DeliveryChallanDetailDTO,
  DeliveryChallanError,
  DeliveryChallanErrorCode,
  DeliveryChallanItemDTO,
  DeliveryChallanSummaryDTO,
  FieldError,
  OrderFulfillmentProgressDTO,
  OrderLineQuantitySnapshot,
} from "@/types/delivery-challan";

/**
 * Internal helpers shared by delivery challan server actions: result envelopes,
 * error mapping, audit trail, quantity snapshots, and DTO serialization.
 */

export const CHALLAN_ENTITY_TYPE = "DeliveryChallan";

export const MAX_CHALLAN_NO_ATTEMPTS = 5;

export type ChallanAuditAction =
  | "DELIVERY_CHALLAN_CREATED"
  | "DELIVERY_CHALLAN_UPDATED"
  | "DELIVERY_CHALLAN_CONFIRMED"
  | "DELIVERY_CHALLAN_CANCELLED";

/* -------------------------------------------------------------------------- */
/*                              Result envelopes                              */
/* -------------------------------------------------------------------------- */

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(
  code: DeliveryChallanErrorCode,
  messageKey: string,
  fieldErrors?: FieldError[],
): ActionResult<T> {
  const error: DeliveryChallanError = { code, messageKey };
  if (fieldErrors && fieldErrors.length > 0) {
    error.fieldErrors = fieldErrors;
  }
  return { success: false, error };
}

export function fromZodError<T>(error: ZodError): ActionResult<T> {
  const fieldErrors: FieldError[] = error.issues.map((issue) => ({
    field: issue.path.map((segment) => String(segment)).join(".") || "_root",
    messageKey: issue.message,
  }));
  return fail<T>("VALIDATION_ERROR", "validation.failed", fieldErrors);
}

export function fromPrismaError<T>(error: unknown): ActionResult<T> {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        const target = normalizeUniqueTarget(error.meta?.target);
        if (target.some((t) => t.includes("challanNo"))) {
          return fail<T>("DUPLICATE_CHALLAN_NO", "challan.error.duplicateChallanNo");
        }
        break;
      }
      case "P2003":
        return fail<T>("CHALLAN_NOT_FOUND", "challan.error.invalidReference");
      case "P2025":
        return fail<T>("CHALLAN_NOT_FOUND", "challan.error.notFound");
      default:
        break;
    }
  }
  return fail<T>("INTERNAL_ERROR", "common.error.unexpected");
}

function normalizeUniqueTarget(target: unknown): string[] {
  if (Array.isArray(target)) {
    return target.map((value) => String(value));
  }
  if (typeof target === "string") {
    return [target];
  }
  return [];
}

/* -------------------------------------------------------------------------- */
/*                              Prisma projections                            */
/* -------------------------------------------------------------------------- */

export const challanSummaryInclude = {
  order: { select: { id: true, orderNo: true } },
  dealer: { select: { dealerCode: true, companyName: true } },
  createdBy: { select: { id: true, name: true } },
  items: { select: { quantity: true } },
  invoice: { select: { id: true } },
} satisfies Prisma.DeliveryChallanInclude;

export const challanDetailInclude = {
  order: { select: { id: true, orderNo: true } },
  dealer: { select: { dealerCode: true, companyName: true } },
  createdBy: { select: { id: true, name: true } },
  confirmedBy: { select: { id: true, name: true } },
  items: {
    include: {
      product: {
        select: { name: true, sku: true, modelNumber: true, unit: true },
      },
    },
    orderBy: { id: "asc" },
  },
  invoice: { select: { id: true } },
} satisfies Prisma.DeliveryChallanInclude;

export type ChallanSummaryRecord = Prisma.DeliveryChallanGetPayload<{
  include: typeof challanSummaryInclude;
}>;

export type ChallanDetailRecord = Prisma.DeliveryChallanGetPayload<{
  include: typeof challanDetailInclude;
}>;

type ChallanItemRecord = ChallanDetailRecord["items"][number];

/* -------------------------------------------------------------------------- */
/*                               Audit trail                                  */
/* -------------------------------------------------------------------------- */

type AuditWriteClient = Pick<Prisma.TransactionClient, "auditLog">;

export async function recordChallanAudit(
  tx: AuditWriteClient,
  params: {
    userId: string;
    challanId: string;
    action: ChallanAuditAction;
    oldValue?: Prisma.InputJsonValue | null;
    newValue?: Prisma.InputJsonValue | null;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: params.userId,
      entityType: CHALLAN_ENTITY_TYPE,
      entityId: params.challanId,
      action: params.action,
      oldValue: params.oldValue ?? Prisma.JsonNull,
      newValue: params.newValue ?? Prisma.JsonNull,
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                         Quantity reconciliation                            */
/* -------------------------------------------------------------------------- */

/**
 * Builds per-line quantity snapshots for an order by aggregating challan lines.
 * When `excludeChallanId` is set, that challan's lines are omitted (used when
 * editing or confirming a specific Draft challan).
 */
export async function loadOrderLineSnapshots(
  tx: Pick<Prisma.TransactionClient, "salesOrder" | "deliveryChallanItem">,
  orderId: string,
  excludeChallanId?: string,
): Promise<
  (OrderLineQuantitySnapshot & { productName: string; productSku: string })[]
> {
  const order = await tx.salesOrder.findUnique({
    where: { id: orderId },
    select: {
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          product: { select: { name: true, sku: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!order) {
    return [];
  }

  const challanLines = await tx.deliveryChallanItem.findMany({
    where: {
      orderItem: { orderId },
      ...(excludeChallanId ? { challanId: { not: excludeChallanId } } : {}),
    },
    select: {
      orderItemId: true,
      quantity: true,
      challan: { select: { id: true, status: true } },
    },
  });

  const confirmedByLine = new Map<string, Prisma.Decimal>();
  const draftByLine = new Map<string, Prisma.Decimal>();

  for (const line of challanLines) {
    const status = line.challan.status;
    if (status === DeliveryChallanStatus.Cancelled) {
      continue;
    }
    const map =
      status === DeliveryChallanStatus.Confirmed
        ? confirmedByLine
        : draftByLine;
    const current = map.get(line.orderItemId) ?? new Prisma.Decimal(0);
    map.set(line.orderItemId, current.plus(line.quantity));
  }

  return order.items.map((item) => ({
    orderItemId: item.id,
    productId: item.productId,
    productName: item.product.name,
    productSku: item.product.sku,
    orderedQuantity: item.quantity.toFixed(2),
    confirmedDeliveredQuantity: (
      confirmedByLine.get(item.id) ?? new Prisma.Decimal(0)
    ).toFixed(2),
    draftDeliveredQuantity: (
      draftByLine.get(item.id) ?? new Prisma.Decimal(0)
    ).toFixed(2),
  }));
}

export function buildFulfillmentProgress(
  orderId: string,
  snapshots: readonly (OrderLineQuantitySnapshot & {
    productName: string;
    productSku: string;
  })[],
  challanCounts: { total: number; confirmed: number },
): OrderFulfillmentProgressDTO {
  const lines = snapshots.map(toOrderLineFulfillment);
  const anyDelivered = lines.some(
    (line) => Number.parseFloat(line.deliveredQuantity) > 0,
  );
  const fullyDelivered =
    lines.length > 0 && lines.every((line) => line.isFullyDelivered);

  return {
    orderId,
    lines,
    isFullyDelivered: fullyDelivered,
    isPartiallyDelivered: anyDelivered && !fullyDelivered,
    challanCount: challanCounts.total,
    confirmedChallanCount: challanCounts.confirmed,
  };
}

export async function countChallansForOrder(
  tx: Pick<Prisma.TransactionClient, "deliveryChallan">,
  orderId: string,
): Promise<{ total: number; confirmed: number }> {
  const [total, confirmed] = await Promise.all([
    tx.deliveryChallan.count({
      where: { orderId, status: { not: DeliveryChallanStatus.Cancelled } },
    }),
    tx.deliveryChallan.count({
      where: { orderId, status: DeliveryChallanStatus.Confirmed },
    }),
  ]);
  return { total, confirmed };
}

/**
 * Recomputes fulfillment and updates the parent order status when a challan is
 * confirmed. Only transitions among Approved / Partially_Delivered / Delivered.
 */
export async function syncOrderStatusAfterChallanConfirm(
  tx: Pick<
    Prisma.TransactionClient,
    "salesOrder" | "deliveryChallan" | "deliveryChallanItem"
  >,
  orderId: string,
): Promise<OrderStatus | null> {
  const order = await tx.salesOrder.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) {
    return null;
  }

  const snapshots = await loadOrderLineSnapshots(tx, orderId);
  const fulfillmentLines = snapshots.map(toOrderLineFulfillment);

  const nextStatus = resolveOrderStatusAfterDelivery(
    order.status,
    fulfillmentLines,
  );

  if (nextStatus !== order.status) {
    await tx.salesOrder.update({
      where: { id: orderId },
      data: { status: nextStatus },
    });
  }

  return nextStatus;
}

/* -------------------------------------------------------------------------- */
/*                              DTO serialization                             */
/* -------------------------------------------------------------------------- */

function sumItemQuantities(
  items: readonly { quantity: Prisma.Decimal }[],
): string {
  const total = items.reduce(
    (acc, item) => acc.plus(item.quantity),
    new Prisma.Decimal(0),
  );
  return total.toFixed(2);
}

function toChallanItemDTO(item: ChallanItemRecord): DeliveryChallanItemDTO {
  return {
    id: item.id,
    orderItemId: item.orderItemId,
    productId: item.productId,
    productName: item.product.name,
    productSku: item.product.sku,
    productModelNumber: item.product.modelNumber,
    unit: item.product.unit,
    quantity: item.quantity.toFixed(2),
  };
}

export function toChallanSummaryDTO(
  challan: ChallanSummaryRecord,
): DeliveryChallanSummaryDTO {
  return {
    id: challan.id,
    challanNo: challan.challanNo,
    orderId: challan.orderId,
    orderNo: challan.order.orderNo,
    dealerCode: challan.dealerCode,
    dealerName: challan.dealer.companyName,
    status: challan.status,
    deliveryMode: challan.deliveryMode,
    vehicleNo: challan.vehicleNo,
    driverName: challan.driverName,
    itemCount: challan.items.length,
    totalQuantity: sumItemQuantities(challan.items),
    hasInvoice: challan.invoice !== null,
    dispatchedAt: challan.dispatchedAt?.toISOString() ?? null,
    createdById: challan.createdById,
    createdByName: challan.createdBy?.name ?? null,
    createdAt: challan.createdAt.toISOString(),
    updatedAt: challan.updatedAt.toISOString(),
  };
}

function readChallanStatus(
  value: Prisma.JsonValue | null,
): DeliveryChallanStatus | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const status = (value as Record<string, unknown>).status;
    if (typeof status === "string") {
      return status as DeliveryChallanStatus;
    }
  }
  return null;
}

/**
 * Loads the ordered lifecycle history for a delivery challan from the audit
 * log. Returns an empty array when no events are recorded.
 */
export async function fetchChallanHistory(
  challanId: string,
): Promise<ChallanHistoryDTO[]> {
  const logs = await prisma.auditLog.findMany({
    where: { entityType: CHALLAN_ENTITY_TYPE, entityId: challanId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    actorId: log.user.id,
    actorName: log.user.name,
    fromStatus: readChallanStatus(log.oldValue),
    toStatus: readChallanStatus(log.newValue),
    remarks: readRemarks(log.newValue),
    timestamp: log.createdAt.toISOString(),
  }));
}

function readRemarks(value: Prisma.JsonValue | null): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const remarks = (value as Record<string, unknown>).remarks;
    if (typeof remarks === "string") {
      return remarks;
    }
  }
  return null;
}

export function toChallanDetailDTO(
  challan: ChallanDetailRecord,
  auditHistory: ChallanHistoryDTO[] = [],
): DeliveryChallanDetailDTO {
  return {
    ...toChallanSummaryDTO(challan),
    items: challan.items.map(toChallanItemDTO),
    remarks: challan.remarks,
    confirmedById: challan.confirmedById,
    confirmedByName: challan.confirmedBy?.name ?? null,
    auditHistory,
  };
}

export async function loadChallanDetailDTO(
  challanId: string,
): Promise<DeliveryChallanDetailDTO | null> {
  const challan = await prisma.deliveryChallan.findUnique({
    where: { id: challanId },
    include: challanDetailInclude,
  });
  if (!challan) {
    return null;
  }
  const auditHistory = await fetchChallanHistory(challanId);
  return toChallanDetailDTO(challan, auditHistory);
}

/* -------------------------------------------------------------------------- */
/*                              Sentinel errors                               */
/* -------------------------------------------------------------------------- */

export class ChallanActionError extends Error {
  readonly code: DeliveryChallanErrorCode;
  readonly messageKey: string;
  readonly fieldErrors?: FieldError[];

  constructor(
    code: DeliveryChallanErrorCode,
    messageKey: string,
    fieldErrors?: FieldError[],
  ) {
    super(code);
    this.name = "ChallanActionError";
    this.code = code;
    this.messageKey = messageKey;
    this.fieldErrors = fieldErrors;
  }
}

export function mapWorkflowError<T>(
  error: import("@/lib/delivery/workflow").DeliveryWorkflowError,
): ActionResult<T> {
  return fail<T>(error.code, error.messageKey);
}

export type { ChallanLineRequest };
