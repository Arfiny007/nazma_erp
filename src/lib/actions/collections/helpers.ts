import { FinancialReferenceType, Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import {
  ReferenceNotFoundError,
  UnsupportedReferenceTypeError,
} from "@/lib/collections/reference-resolver";
import { FINANCIAL_REFERENCE_INVOICE } from "@/lib/finance/types";
import type {
  ActionResult,
  CollectionAllocationDTO,
  CollectionDetailDTO,
  CollectionDTO,
  CollectionError,
  CollectionErrorCode,
  CollectionHistoryDTO,
  CollectionListItemDTO,
  FieldError,
} from "@/types/collection";

/**
 * Internal helpers shared by collection server actions.
 */

export const COLLECTION_ENTITY_TYPE = "Collection";

export const MAX_COLLECTION_NO_ATTEMPTS = 5;

export const ZERO_MONEY = new Prisma.Decimal(0);

export type CollectionAuditAction =
  | "COLLECTION_CREATED"
  | "COLLECTION_CONFIRMED"
  | "COLLECTION_ALLOCATED"
  | "COLLECTION_DEALLOCATED"
  | "COLLECTION_REVERSED"
  | "COLLECTION_REVERSED_MISALLOCATION";

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(
  code: CollectionErrorCode,
  messageKey: string,
  fieldErrors?: FieldError[],
): ActionResult<T> {
  const error: CollectionError = { code, messageKey };
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
        if (target.some((t) => t.includes("collectionNo"))) {
          return fail<T>(
            "DUPLICATE_COLLECTION_NO",
            "collection.error.duplicateCollectionNo",
          );
        }
        if (
          target.some(
            (t) =>
              t.includes("collectionId") &&
              (t.includes("referenceType") || t.includes("referenceId")),
          )
        ) {
          return fail<T>(
            "DUPLICATE_ALLOCATION",
            "collection.error.duplicateAllocation",
          );
        }
        break;
      }
      case "P2003":
        return fail<T>("DEALER_NOT_FOUND", "collection.error.invalidReference");
      case "P2025":
        return fail<T>("COLLECTION_NOT_FOUND", "collection.error.notFound");
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

export const collectionListInclude = {
  dealer: { select: { dealerCode: true, companyName: true } },
} satisfies Prisma.CollectionInclude;

export const collectionDetailInclude = {
  dealer: { select: { dealerCode: true, companyName: true } },
  createdBy: { select: { id: true, name: true } },
  confirmedBy: { select: { id: true, name: true } },
  allocations: { orderBy: { allocationOrder: "asc" } },
} satisfies Prisma.CollectionInclude;

export type CollectionListRecord = Prisma.CollectionGetPayload<{
  include: typeof collectionListInclude;
}>;

export type CollectionDetailRecord = Prisma.CollectionGetPayload<{
  include: typeof collectionDetailInclude;
}>;

type AuditWriteClient = Pick<Prisma.TransactionClient, "auditLog">;

export async function recordCollectionAudit(
  tx: AuditWriteClient,
  params: {
    userId: string;
    collectionId: string;
    action: CollectionAuditAction;
    newValue: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: params.userId,
      entityType: COLLECTION_ENTITY_TYPE,
      entityId: params.collectionId,
      action: params.action,
      oldValue: Prisma.JsonNull,
      newValue: params.newValue,
    },
  });
}

async function resolveReferenceLabel(
  referenceType: FinancialReferenceType,
  referenceId: string,
): Promise<string | null> {
  if (referenceType === FINANCIAL_REFERENCE_INVOICE) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: referenceId },
      select: { invoiceNo: true },
    });
    return invoice?.invoiceNo ?? null;
  }
  return null;
}

export function toCollectionAllocationDTO(
  row: CollectionDetailRecord["allocations"][number],
  referenceLabel: string | null,
): CollectionAllocationDTO {
  return {
    id: row.id,
    collectionId: row.collectionId,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    referenceLabel,
    allocatedAmount: row.allocatedAmount.toFixed(2),
    allocationOrder: row.allocationOrder,
    remarks: row.remarks,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCollectionDTO(
  collection: CollectionDetailRecord,
): CollectionDTO {
  return {
    id: collection.id,
    collectionNo: collection.collectionNo,
    dealerCode: collection.dealerCode,
    dealerName: collection.dealer.companyName,
    collectionDate: collection.collectionDate.toISOString(),
    paymentMethod: collection.paymentMethod,
    referenceNumber: collection.referenceNumber,
    bankName: collection.bankName,
    remarks: collection.remarks,
    receivedAmount: collection.receivedAmount.toFixed(2),
    allocatedAmount: collection.allocatedAmount.toFixed(2),
    unallocatedAmount: collection.unallocatedAmount.toFixed(2),
    status: collection.status,
    isAdvancePayment: collection.isAdvancePayment,
    confirmedAt: collection.confirmedAt?.toISOString() ?? null,
    confirmedById: collection.confirmedById,
    confirmedByName: collection.confirmedBy?.name ?? null,
    reversedAt: collection.reversedAt?.toISOString() ?? null,
    reversedCollectionId: collection.reversedCollectionId,
    reversalReason: collection.reversalReason,
    createdById: collection.createdById,
    createdByName: collection.createdBy?.name ?? null,
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
  };
}

function readAuditRemarks(value: Prisma.JsonValue | null): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const remarks = (value as Record<string, unknown>).remarks;
    if (typeof remarks === "string") {
      return remarks;
    }
    const reason = (value as Record<string, unknown>).reason;
    if (typeof reason === "string") {
      return reason;
    }
  }
  return null;
}

export async function fetchCollectionHistory(
  collectionId: string,
): Promise<CollectionHistoryDTO[]> {
  const logs = await prisma.auditLog.findMany({
    where: { entityType: COLLECTION_ENTITY_TYPE, entityId: collectionId },
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

export async function toCollectionDetailDTO(
  collection: CollectionDetailRecord,
  auditHistory: CollectionHistoryDTO[] = [],
): Promise<CollectionDetailDTO> {
  const allocations = await Promise.all(
    collection.allocations.map(async (row) => {
      const label = await resolveReferenceLabel(
        row.referenceType,
        row.referenceId,
      );
      return toCollectionAllocationDTO(row, label);
    }),
  );

  return {
    ...toCollectionDTO(collection),
    allocations,
    auditHistory,
  };
}

export function toCollectionListItemDTO(
  collection: CollectionListRecord,
): CollectionListItemDTO {
  return {
    id: collection.id,
    collectionNo: collection.collectionNo,
    dealerCode: collection.dealerCode,
    dealerName: collection.dealer.companyName,
    collectionDate: collection.collectionDate.toISOString(),
    paymentMethod: collection.paymentMethod,
    receivedAmount: collection.receivedAmount.toFixed(2),
    allocatedAmount: collection.allocatedAmount.toFixed(2),
    unallocatedAmount: collection.unallocatedAmount.toFixed(2),
    status: collection.status,
    isAdvancePayment: collection.isAdvancePayment,
    confirmedAt: collection.confirmedAt?.toISOString() ?? null,
    createdAt: collection.createdAt.toISOString(),
  };
}

export async function loadCollectionDetailDTO(
  collectionId: string,
): Promise<CollectionDetailDTO | null> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: collectionDetailInclude,
  });
  if (!collection) {
    return null;
  }
  const auditHistory = await fetchCollectionHistory(collectionId);
  return toCollectionDetailDTO(collection, auditHistory);
}

export class CollectionActionError extends Error {
  readonly code: CollectionErrorCode;
  readonly messageKey: string;

  constructor(code: CollectionErrorCode, messageKey: string) {
    super(code);
    this.name = "CollectionActionError";
    this.code = code;
    this.messageKey = messageKey;
  }
}

export function mapCollectionWorkflowError<T>(
  error: import("@/lib/collections/workflow").CollectionWorkflowError,
): ActionResult<T> {
  return fail<T>(error.code, error.messageKey);
}

export function mapReferenceError<T>(error: unknown): ActionResult<T> | null {
  if (error instanceof ReferenceNotFoundError) {
    return fail<T>("REFERENCE_NOT_FOUND", "collection.error.referenceNotFound");
  }
  if (error instanceof UnsupportedReferenceTypeError) {
    return fail<T>("VALIDATION_ERROR", "collection.error.unsupportedReference");
  }
  return null;
}
