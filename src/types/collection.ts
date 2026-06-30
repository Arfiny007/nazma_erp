import type {
  CollectionPaymentMethod,
  CollectionStatus,
  FinancialReferenceType,
} from "@prisma/client";

/**
 * Domain types for the Collections module.
 *
 * Collections represent cash received from dealers. Allocation to financial
 * documents is a separate concern handled by {@link CollectionAllocationDTO}.
 *
 * Monetary values are exposed as fixed-precision decimal strings for safe
 * Server/Client transport. See ADR-019.
 */

export type { CollectionPaymentMethod, CollectionStatus, FinancialReferenceType };

/* -------------------------------------------------------------------------- */
/*                          Data transfer / view models                      */
/* -------------------------------------------------------------------------- */

/** Row-level projection used by the collection listing backend. */
export interface CollectionListItemDTO {
  id: string;
  collectionNo: string;
  dealerCode: string;
  dealerName: string;
  collectionDate: string;
  paymentMethod: CollectionPaymentMethod;
  receivedAmount: string;
  allocatedAmount: string;
  unallocatedAmount: string;
  status: CollectionStatus;
  isAdvancePayment: boolean;
  confirmedAt: string | null;
  createdAt: string;
}

/** Core collection projection for create/update responses. */
export interface CollectionDTO {
  id: string;
  collectionNo: string;
  dealerCode: string;
  dealerName: string;
  collectionDate: string;
  paymentMethod: CollectionPaymentMethod;
  referenceNumber: string | null;
  bankName: string | null;
  remarks: string | null;
  receivedAmount: string;
  allocatedAmount: string;
  unallocatedAmount: string;
  status: CollectionStatus;
  isAdvancePayment: boolean;
  confirmedAt: string | null;
  confirmedById: string | null;
  confirmedByName: string | null;
  reversedAt: string | null;
  reversedCollectionId: string | null;
  reversalReason: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Generic allocation row — not invoice-specific. */
export interface CollectionAllocationDTO {
  id: string;
  collectionId: string;
  referenceType: FinancialReferenceType;
  referenceId: string;
  /** Human-readable reference label (e.g. invoice number) when resolved. */
  referenceLabel: string | null;
  allocatedAmount: string;
  allocationOrder: number;
  remarks: string | null;
  createdAt: string;
}

/** Audit timeline entry for collection detail views. */
export interface CollectionHistoryDTO {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  remarks: string | null;
  timestamp: string;
}

/** Full collection projection including allocation rows. */
export interface CollectionDetailDTO extends CollectionDTO {
  allocations: CollectionAllocationDTO[];
  auditHistory: CollectionHistoryDTO[];
}

/** Open invoice row for the allocation workspace (allocatable cap from server). */
export interface OutstandingInvoiceDTO {
  id: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  grandTotal: string;
  collectionReceived: string;
  /** Allocatable remainder — `grandTotal − collectionReceived`. */
  allocatableOutstanding: string;
  /** Statement position — `currentDue − collectionReceived` (display only). */
  statementOutstanding: string;
  status: import("@prisma/client").InvoiceStatus;
}

/** Dealer context loaded by the collection workspace. */
export interface DealerCollectionContextDTO {
  dealer: DealerFinancialSummaryDTO;
  outstandingInvoices: OutstandingInvoiceDTO[];
}

/** Dealer-level financial snapshot for collection workflows and reporting. */
export interface DealerFinancialSummaryDTO {
  dealerCode: string;
  dealerName: string;
  /** AR balance — positive: dealer owes; negative: company owes dealer. */
  currentBalance: string;
  creditLimit: string;
  availableCredit: string;
  monthlyTarget: string;
  yearlyTarget: string;
  totalSales: string;
  lastCollectionDate: string | null;
  lastInvoiceDate: string | null;
  /** Sum of unallocated amounts on confirmed collections (future PHASE_06A2). */
  unallocatedCollectionTotal: string;
}

/** Summary of advance payment / customer credit exposure for a dealer. */
export interface AdvancePaymentSummaryDTO {
  dealerCode: string;
  dealerName: string;
  /** Negative AR balance magnitude when dealer has credit; otherwise "0.00". */
  advanceCreditBalance: string;
  /** Count of confirmed collections with unallocated remainder. */
  unallocatedCollectionCount: number;
  /** Sum of unallocated amounts across confirmed collections. */
  unallocatedAmountTotal: string;
}

/* -------------------------------------------------------------------------- */
/*                              Listing & paging                              */
/* -------------------------------------------------------------------------- */

export const COLLECTION_SORT_FIELDS = [
  "collectionNo",
  "collectionDate",
  "status",
  "receivedAmount",
  "confirmedAt",
  "createdAt",
] as const;

export type CollectionSortField = (typeof COLLECTION_SORT_FIELDS)[number];

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

export type CollectionErrorCode =
  | "VALIDATION_ERROR"
  | "COLLECTION_NOT_FOUND"
  | "DEALER_NOT_FOUND"
  | "COLLECTION_ALREADY_CONFIRMED"
  | "COLLECTION_ALREADY_REVERSED"
  | "COLLECTION_NOT_CONFIRMED"
  | "ALLOCATION_EXCEEDS_RECEIVED"
  | "DUPLICATE_COLLECTION_NO"
  | "DUPLICATE_ALLOCATION"
  | "INVALID_STATUS_TRANSITION"
  | "REFERENCE_NOT_FOUND"
  | "INVOICE_ALREADY_PAID"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

export interface FieldError {
  field: string;
  messageKey: string;
}

export interface CollectionError {
  code: CollectionErrorCode;
  messageKey: string;
  fieldErrors?: FieldError[];
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: CollectionError };

/* -------------------------------------------------------------------------- */
/*                         Allocation preview input                           */
/* -------------------------------------------------------------------------- */

/** One proposed allocation line for preview validation (PHASE_06A2). */
export interface AllocationPreviewLine {
  referenceType: FinancialReferenceType;
  referenceId: string;
  allocatedAmount: string;
  allocationOrder: number;
  remarks?: string | null;
}
