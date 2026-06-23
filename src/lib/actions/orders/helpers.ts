import { OrderStatus, Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import type { CalculatorLineInput } from "@/lib/utils/order-calculator";
import { generateNextProjectCode } from "@/lib/utils/project-code";
import type {
  ActionResult,
  ApprovalHistoryDTO,
  FieldError,
  OrderDetailDTO,
  OrderError,
  OrderErrorCode,
  OrderItemDTO,
  OrderSummaryDTO,
} from "@/types/order";

/**
 * Internal (non-action) helpers shared by the order server actions: result
 * envelope constructors, error mapping, audit-trail writing and DTO
 * serialization. This module is kept separate from the `"use server"` action
 * files, whose exports must all be async functions.
 */

/** AuditLog `entityType` discriminator for sales orders. */
export const ORDER_ENTITY_TYPE = "SalesOrder";

/** Number of attempts to retry on an order-number unique collision under load. */
export const MAX_ORDER_NO_ATTEMPTS = 5;

/* -------------------------------------------------------------------------- */
/*                              Result envelopes                              */
/* -------------------------------------------------------------------------- */

/** Wraps a successful payload in the success branch of {@link ActionResult}. */
export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

/** Builds the failure branch of {@link ActionResult}. */
export function fail<T>(
  code: OrderErrorCode,
  messageKey: string,
  fieldErrors?: FieldError[],
): ActionResult<T> {
  const error: OrderError = { code, messageKey };
  if (fieldErrors && fieldErrors.length > 0) {
    error.fieldErrors = fieldErrors;
  }
  return { success: false, error };
}

/** Converts a {@link ZodError} into a typed VALIDATION_ERROR result. */
export function fromZodError<T>(error: ZodError): ActionResult<T> {
  const fieldErrors: FieldError[] = error.issues.map((issue) => ({
    field: issue.path.map((segment) => String(segment)).join(".") || "_root",
    messageKey: issue.message,
  }));

  return fail<T>("VALIDATION_ERROR", "validation.failed", fieldErrors);
}

/**
 * Maps a thrown Prisma error to a typed result. Unknown errors collapse to a
 * generic INTERNAL_ERROR so raw database details never leak to callers.
 */
export function fromPrismaError<T>(error: unknown): ActionResult<T> {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        const target = normalizeUniqueTarget(error.meta?.target);
        if (target.some((t) => t.includes("projectCode") || t.includes("name"))) {
          return fail<T>("DUPLICATE_PROJECT", "order.error.duplicateProject");
        }
        return fail<T>("DUPLICATE_ORDER_NO", "order.error.duplicateOrderNo");
      }
      case "P2003":
        return fail<T>("ORDER_NOT_FOUND", "order.error.invalidReference");
      case "P2025":
        return fail<T>("ORDER_NOT_FOUND", "order.error.notFound");
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

export const orderSummaryInclude = {
  dealer: { select: { dealerCode: true, companyName: true } },
  project: { select: { id: true, projectCode: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { items: true, invoices: true } },
} satisfies Prisma.SalesOrderInclude;

export const orderDetailInclude = {
  dealer: { select: { dealerCode: true, companyName: true } },
  project: { select: { id: true, projectCode: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  items: {
    include: {
      product: {
        select: { name: true, sku: true, modelNumber: true, unit: true },
      },
    },
    orderBy: { id: "asc" },
  },
  _count: { select: { items: true, invoices: true } },
} satisfies Prisma.SalesOrderInclude;

export type OrderSummaryRecord = Prisma.SalesOrderGetPayload<{
  include: typeof orderSummaryInclude;
}>;

export type OrderDetailRecord = Prisma.SalesOrderGetPayload<{
  include: typeof orderDetailInclude;
}>;

type OrderItemRecord = OrderDetailRecord["items"][number];

/* -------------------------------------------------------------------------- */
/*                               Audit trail                                  */
/* -------------------------------------------------------------------------- */

/** Lifecycle action recorded against an order in the audit log. */
export type OrderAuditAction =
  | "CREATE"
  | "SUBMIT"
  | "UPDATE"
  | "APPROVE"
  | "REJECT"
  | "CANCEL";

type AuditWriteClient = Pick<Prisma.TransactionClient, "auditLog">;

/**
 * Records a lifecycle event for an order in the {@link AuditLog}. Designed to
 * run inside the same transaction as the mutation it describes so the audit
 * trail and the order state can never diverge.
 */
export async function recordOrderAudit(
  tx: AuditWriteClient,
  params: {
    userId: string;
    orderId: string;
    action: OrderAuditAction;
    fromStatus?: OrderStatus | null;
    toStatus: OrderStatus;
    remarks?: string | null;
  },
): Promise<void> {
  const newValue: Prisma.JsonObject = { status: params.toStatus };
  if (params.remarks) {
    newValue.remarks = params.remarks;
  }

  await tx.auditLog.create({
    data: {
      userId: params.userId,
      entityType: ORDER_ENTITY_TYPE,
      entityId: params.orderId,
      action: params.action,
      oldValue: params.fromStatus ? { status: params.fromStatus } : Prisma.JsonNull,
      newValue,
    },
  });
}

const ORDER_STATUS_VALUES = Object.values(OrderStatus) as string[];

function readStatus(value: Prisma.JsonValue | null): OrderStatus | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const status = (value as Record<string, unknown>).status;
    if (typeof status === "string" && ORDER_STATUS_VALUES.includes(status)) {
      return status as OrderStatus;
    }
  }
  return null;
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

/**
 * Loads the ordered approval / lifecycle history for an order from the audit
 * log. Returns an empty array when the order has no recorded events.
 */
export async function fetchApprovalHistory(
  orderId: string,
): Promise<ApprovalHistoryDTO[]> {
  const logs = await prisma.auditLog.findMany({
    where: { entityType: ORDER_ENTITY_TYPE, entityId: orderId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    actorId: log.user.id,
    actorName: log.user.name,
    fromStatus: readStatus(log.oldValue),
    toStatus: readStatus(log.newValue),
    remarks: readRemarks(log.newValue),
    timestamp: log.createdAt.toISOString(),
  }));
}

/* -------------------------------------------------------------------------- */
/*                              DTO serialization                             */
/* -------------------------------------------------------------------------- */

/** Serializes a single order line into a transport-safe DTO. */
export function toOrderItemDTO(item: OrderItemRecord): OrderItemDTO {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.product.name,
    productSku: item.product.sku,
    productModelNumber: item.product.modelNumber,
    unit: item.product.unit,
    quantity: item.quantity.toFixed(2),
    unitPrice: item.unitPrice.toFixed(2),
    discount: item.discount.toFixed(2),
    total: item.total.toFixed(2),
  };
}

/** Serializes an order (with summary includes) into a row-level DTO. */
export function toOrderSummaryDTO(order: OrderSummaryRecord): OrderSummaryDTO {
  return {
    id: order.id,
    orderNo: order.orderNo,
    dealerCode: order.dealerCode,
    dealerName: order.dealer.companyName,
    projectId: order.projectId,
    projectName: order.project?.name ?? null,
    status: order.status,
    subtotal: order.subtotal.toFixed(2),
    discount: order.discount.toFixed(2),
    vat: order.vat.toFixed(2),
    grandTotal: order.grandTotal.toFixed(2),
    itemCount: order._count.items,
    invoiceCount: order._count.invoices,
    createdById: order.createdById,
    createdByName: order.createdBy?.name ?? null,
    approvedById: order.approvedById,
    approvedAt: order.approvedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

/** Serializes a fully-loaded order (with items + history) into a detail DTO. */
export function toOrderDetailDTO(
  order: OrderDetailRecord,
  approvalHistory: ApprovalHistoryDTO[],
): OrderDetailDTO {
  return {
    id: order.id,
    orderNo: order.orderNo,
    dealerCode: order.dealerCode,
    dealerName: order.dealer.companyName,
    projectId: order.projectId,
    projectName: order.project?.name ?? null,
    status: order.status,
    subtotal: order.subtotal.toFixed(2),
    discount: order.discount.toFixed(2),
    vat: order.vat.toFixed(2),
    grandTotal: order.grandTotal.toFixed(2),
    itemCount: order._count.items,
    invoiceCount: order._count.invoices,
    createdById: order.createdById,
    createdByName: order.createdBy?.name ?? null,
    approvedById: order.approvedById,
    approvedAt: order.approvedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    dealer: {
      dealerCode: order.dealer.dealerCode,
      companyName: order.dealer.companyName,
    },
    project: order.project
      ? {
          id: order.project.id,
          projectCode: order.project.projectCode,
          name: order.project.name,
        }
      : null,
    createdBy: order.createdBy
      ? { id: order.createdBy.id, name: order.createdBy.name }
      : null,
    approvedBy: order.approvedBy
      ? { id: order.approvedBy.id, name: order.approvedBy.name }
      : null,
    items: order.items.map(toOrderItemDTO),
    approvalHistory,
  };
}

/**
 * Loads a complete order detail DTO (including audit-derived approval history)
 * by id, or returns `null` when the order does not exist.
 */
export async function loadOrderDetailDTO(
  orderId: string,
): Promise<OrderDetailDTO | null> {
  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: orderDetailInclude,
  });
  if (!order) {
    return null;
  }
  const history = await fetchApprovalHistory(orderId);
  return toOrderDetailDTO(order, history);
}

/* -------------------------------------------------------------------------- */
/*                              Sentinel errors                               */
/* -------------------------------------------------------------------------- */

/** Generic sentinel carrying a typed order error code + localization key. */
export class OrderActionError extends Error {
  readonly code: OrderErrorCode;
  readonly messageKey: string;
  readonly fieldErrors?: FieldError[];

  constructor(
    code: OrderErrorCode,
    messageKey: string,
    fieldErrors?: FieldError[],
  ) {
    super(code);
    this.name = "OrderActionError";
    this.code = code;
    this.messageKey = messageKey;
    this.fieldErrors = fieldErrors;
  }
}

/* -------------------------------------------------------------------------- */
/*                          Shared transactional helpers                      */
/* -------------------------------------------------------------------------- */

/** Inline project payload (already normalized by the validator). */
export interface InlineProjectData {
  name: string;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
}

/**
 * Resolves the order's project inside a transaction: validates that an existing
 * `projectId` belongs to the dealer, or creates an inline project. Returns
 * `null` when no project is associated with the order.
 *
 * @throws OrderActionError PROJECT_NOT_FOUND / DUPLICATE_PROJECT
 */
export async function resolveProjectId(
  tx: Prisma.TransactionClient,
  dealerId: string,
  data: { projectId?: string | null; project?: InlineProjectData },
): Promise<string | null> {
  if (data.projectId) {
    const project = await tx.project.findUnique({
      where: { id: data.projectId },
      select: { id: true, dealerId: true },
    });
    if (!project || project.dealerId !== dealerId) {
      throw new OrderActionError(
        "PROJECT_NOT_FOUND",
        "order.error.projectNotFound",
        [{ field: "projectId", messageKey: "order.error.projectNotFound" }],
      );
    }
    return project.id;
  }

  if (data.project) {
    const duplicate = await tx.project.findFirst({
      where: { dealerId, name: data.project.name },
      select: { id: true },
    });
    if (duplicate) {
      throw new OrderActionError(
        "DUPLICATE_PROJECT",
        "order.error.duplicateProject",
        [{ field: "project.name", messageKey: "order.error.duplicateProject" }],
      );
    }

    const projectCode = await generateNextProjectCode(tx);
    const created = await tx.project.create({
      data: {
        dealerId,
        projectCode,
        name: data.project.name,
        address: data.project.address,
        contactName: data.project.contactName,
        contactPhone: data.project.contactPhone,
      },
      select: { id: true },
    });
    return created.id;
  }

  return null;
}

/** A raw order line as accepted on input, before price resolution. */
export interface RawLineInput {
  productId: string;
  quantity: string;
  unitPrice?: string;
  discount?: string;
}

/**
 * Validates every referenced product exists and is active, then resolves each
 * line's effective unit price (explicit input, else the product's current
 * price). Returns Decimal-safe inputs for the calculation engine.
 *
 * @throws OrderActionError PRODUCT_NOT_FOUND / INACTIVE_PRODUCT
 */
export async function buildLineInputs(
  tx: Prisma.TransactionClient,
  items: readonly RawLineInput[],
): Promise<CalculatorLineInput[]> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, currentPrice: true, isActive: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  return items.map((item) => {
    const product = byId.get(item.productId);
    if (!product) {
      throw new OrderActionError(
        "PRODUCT_NOT_FOUND",
        "order.error.productNotFound",
        [{ field: "items.productId", messageKey: "order.error.productNotFound" }],
      );
    }
    if (!product.isActive) {
      throw new OrderActionError(
        "INACTIVE_PRODUCT",
        "order.error.inactiveProduct",
        [{ field: "items.productId", messageKey: "order.error.inactiveProduct" }],
      );
    }

    return {
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? product.currentPrice,
      discount: item.discount ?? "0",
    };
  });
}
