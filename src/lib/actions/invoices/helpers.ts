import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import type {
  ActionResult,
  FieldError,
  InvoiceDetailDTO,
  InvoiceError,
  InvoiceErrorCode,
  InvoiceHistoryDTO,
  InvoiceItemDTO,
  InvoiceSummaryDTO,
} from "@/types/invoice";

/**
 * Internal helpers shared by invoice server actions.
 */

export const INVOICE_ENTITY_TYPE = "Invoice";

export const MAX_INVOICE_NO_ATTEMPTS = 5;

export type InvoiceAuditAction = "INVOICE_CREATED";

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(
  code: InvoiceErrorCode,
  messageKey: string,
  fieldErrors?: FieldError[],
): ActionResult<T> {
  const error: InvoiceError = { code, messageKey };
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
        if (target.some((t) => t.includes("invoiceNo"))) {
          return fail<T>("DUPLICATE_INVOICE_NO", "invoice.error.duplicateInvoiceNo");
        }
        if (target.some((t) => t.includes("deliveryChallanId"))) {
          return fail<T>("INVOICE_ALREADY_EXISTS", "invoice.error.alreadyExists");
        }
        break;
      }
      case "P2003":
        return fail<T>("CHALLAN_NOT_FOUND", "invoice.error.invalidReference");
      case "P2025":
        return fail<T>("INVOICE_NOT_FOUND", "invoice.error.notFound");
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

export const invoiceSummaryInclude = {
  dealer: {
    select: {
      dealerCode: true,
      companyName: true,
      address: true,
      mobile: true,
      email: true,
      territory: true,
    },
  },
  order: { select: { id: true, orderNo: true } },
  deliveryChallan: { select: { id: true, challanNo: true } },
} satisfies Prisma.InvoiceInclude;

export const invoiceDetailInclude = {
  dealer: {
    select: {
      dealerCode: true,
      companyName: true,
      address: true,
      mobile: true,
      email: true,
      territory: true,
    },
  },
  order: {
    select: {
      id: true,
      orderNo: true,
      createdBy: { select: { name: true } },
    },
  },
  deliveryChallan: { select: { id: true, challanNo: true } },
  items: { orderBy: { id: "asc" } },
} satisfies Prisma.InvoiceInclude;

export type InvoiceSummaryRecord = Prisma.InvoiceGetPayload<{
  include: typeof invoiceSummaryInclude;
}>;

export type InvoiceDetailRecord = Prisma.InvoiceGetPayload<{
  include: typeof invoiceDetailInclude;
}>;

type InvoiceItemRecord = InvoiceDetailRecord["items"][number];

type AuditWriteClient = Pick<Prisma.TransactionClient, "auditLog">;

export async function recordInvoiceAudit(
  tx: AuditWriteClient,
  params: {
    userId: string;
    invoiceId: string;
    action: InvoiceAuditAction;
    newValue: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: params.userId,
      entityType: INVOICE_ENTITY_TYPE,
      entityId: params.invoiceId,
      action: params.action,
      oldValue: Prisma.JsonNull,
      newValue: params.newValue,
    },
  });
}

function toInvoiceItemDTO(item: InvoiceItemRecord): InvoiceItemDTO {
  return {
    id: item.id,
    productId: item.productId,
    productCode: item.productCode,
    productName: item.productName,
    unit: item.unit,
    quantity: item.quantity.toFixed(2),
    unitPrice: item.unitPrice.toFixed(2),
    discount: item.discount.toFixed(2),
    lineTotal: item.lineTotal.toFixed(2),
    orderItemId: item.orderItemId,
    challanItemId: item.challanItemId,
  };
}

export function toInvoiceSummaryDTO(
  invoice: InvoiceSummaryRecord,
): InvoiceSummaryDTO {
  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    dealerCode: invoice.dealerCode,
    dealerName: invoice.dealer.companyName,
    orderId: invoice.orderId,
    orderNo: invoice.order.orderNo,
    deliveryChallanId: invoice.deliveryChallanId,
    challanNo: invoice.deliveryChallan?.challanNo ?? null,
    status: invoice.status,
    subtotal: invoice.subtotal.toFixed(2),
    discount: invoice.discount.toFixed(2),
    vat: invoice.vat.toFixed(2),
    grandTotal: invoice.grandTotal.toFixed(2),
    previousDue: invoice.previousDue.toFixed(2),
    currentDue: invoice.currentDue.toFixed(2),
    collectionReceived: invoice.collectionReceived.toFixed(2),
    outstanding: invoice.currentDue
      .sub(invoice.collectionReceived)
      .toFixed(2),
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
  };
}

export function toInvoiceDetailDTO(
  invoice: InvoiceDetailRecord,
  auditHistory: InvoiceHistoryDTO[] = [],
): InvoiceDetailDTO {
  return {
    ...toInvoiceSummaryDTO(invoice),
    items: invoice.items.map(toInvoiceItemDTO),
    deliveryMode: invoice.deliveryMode,
    vehicleNo: invoice.vehicleNo,
    driverName: invoice.driverName,
    dealerAddress: invoice.dealer.address,
    dealerMobile: invoice.dealer.mobile,
    dealerEmail: invoice.dealer.email,
    salesPerson: invoice.order.createdBy?.name ?? null,
    auditHistory,
  };
}

function readAuditRemarks(value: Prisma.JsonValue | null): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const remarks = (value as Record<string, unknown>).remarks;
    if (typeof remarks === "string") {
      return remarks;
    }
  }
  return null;
}

export async function fetchInvoiceHistory(
  invoiceId: string,
): Promise<InvoiceHistoryDTO[]> {
  const logs = await prisma.auditLog.findMany({
    where: { entityType: INVOICE_ENTITY_TYPE, entityId: invoiceId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    actorId: log.user.id,
    actorName: log.user.name,
    remarks: readAuditRemarks(log.newValue),
    timestamp: log.createdAt.toISOString(),
  }));
}

export async function loadInvoiceDetailDTO(
  invoiceId: string,
): Promise<InvoiceDetailDTO | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: invoiceDetailInclude,
  });
  if (!invoice) {
    return null;
  }
  const auditHistory = await fetchInvoiceHistory(invoiceId);
  return toInvoiceDetailDTO(invoice, auditHistory);
}

export class InvoiceActionError extends Error {
  readonly code: InvoiceErrorCode;
  readonly messageKey: string;

  constructor(code: InvoiceErrorCode, messageKey: string) {
    super(code);
    this.name = "InvoiceActionError";
    this.code = code;
    this.messageKey = messageKey;
  }
}

export function mapInvoiceWorkflowError<T>(
  error: import("@/lib/invoices/workflow").InvoiceWorkflowError,
): ActionResult<T> {
  return fail<T>(error.code, error.messageKey);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export const ZERO_MONEY = new Prisma.Decimal(0);
