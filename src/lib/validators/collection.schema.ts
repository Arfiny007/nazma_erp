import { z } from "zod";
import {
  CollectionPaymentMethod,
  CollectionStatus,
  FinancialReferenceType,
} from "@prisma/client";

import { COLLECTION_SORT_FIELDS } from "@/types/collection";

/**
 * Zod validation schemas for the Collections module.
 *
 * Validation contracts only — business rules (confirmation, allocation caps,
 * immutability after confirm, reversal) are enforced in workflow guards and
 * server actions in PHASE_06A2+.
 */

/** Largest value representable by `@db.Decimal(18,2)` (16 integer digits). */
const DECIMAL_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;

/**
 * Validates a non-negative monetary amount fitting `Decimal(18,2)` and returns
 * it as a normalized decimal string.
 */
const moneyAmountSchema = z
  .union([z.string(), z.number()], { error: "validation.amount.required" })
  .transform((value) =>
    typeof value === "number" ? value.toString() : value.trim(),
  )
  .refine((value) => DECIMAL_PATTERN.test(value), {
    error: "validation.amount.invalid",
  })
  .refine((value) => Number.parseFloat(value) >= 0, {
    error: "validation.amount.nonNegative",
  });

/**
 * Validates a strictly-positive monetary amount fitting `Decimal(18,2)`.
 */
const positiveMoneyAmountSchema = moneyAmountSchema.refine(
  (value) => Number.parseFloat(value) > 0,
  { error: "validation.amount.positive" },
);

const collectionIdSchema = z.uuid({ error: "validation.id.invalid" });

const dealerCodeSchema = z
  .string()
  .trim()
  .min(1, { error: "validation.dealerCode.required" });

const sortOrderSchema = z.enum(["asc", "desc"], {
  error: "validation.sortOrder.invalid",
});

function optionalTrimmed(inner: z.ZodType<string>): z.ZodType<string | null> {
  return z.preprocess((value) => {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }
    return value;
  }, inner.nullable());
}

const allocationLineSchema = z.object({
  referenceType: z.nativeEnum(FinancialReferenceType, {
    error: "validation.referenceType.invalid",
  }),
  referenceId: z.uuid({ error: "validation.id.invalid" }),
  allocatedAmount: positiveMoneyAmountSchema,
  allocationOrder: z.coerce.number().int().min(0),
  remarks: optionalTrimmed(z.string().max(500)),
});

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

export const createCollectionSchema = z.object({
  dealerCode: dealerCodeSchema,
  collectionDate: z.coerce.date({ error: "validation.collectionDate.invalid" }),
  paymentMethod: z.nativeEnum(CollectionPaymentMethod, {
    error: "validation.paymentMethod.invalid",
  }),
  receivedAmount: positiveMoneyAmountSchema,
  referenceNumber: optionalTrimmed(z.string().max(100)),
  bankName: optionalTrimmed(z.string().max(100)),
  remarks: optionalTrimmed(z.string().max(500)),
  isAdvancePayment: z.boolean().default(false),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;

/* -------------------------------------------------------------------------- */
/*                                   Update                                   */
/* -------------------------------------------------------------------------- */

export const updateCollectionSchema = z.object({
  id: collectionIdSchema,
  collectionDate: z.coerce
    .date({ error: "validation.collectionDate.invalid" })
    .optional(),
  paymentMethod: z
    .nativeEnum(CollectionPaymentMethod, {
      error: "validation.paymentMethod.invalid",
    })
    .optional(),
  receivedAmount: positiveMoneyAmountSchema.optional(),
  referenceNumber: optionalTrimmed(z.string().max(100)).optional(),
  bankName: optionalTrimmed(z.string().max(100)).optional(),
  remarks: optionalTrimmed(z.string().max(500)).optional(),
  isAdvancePayment: z.boolean().optional(),
});

export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;

/* -------------------------------------------------------------------------- */
/*                                    List                                    */
/* -------------------------------------------------------------------------- */

export const listCollectionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  dealerCode: dealerCodeSchema.optional(),
  status: z.nativeEnum(CollectionStatus).optional(),
  paymentMethod: z.nativeEnum(CollectionPaymentMethod).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  isAdvancePayment: z.coerce.boolean().optional(),
  sortBy: z.enum(COLLECTION_SORT_FIELDS).default("collectionDate"),
  sortOrder: sortOrderSchema.default("desc"),
});

export type ListCollectionsInput = z.infer<typeof listCollectionsSchema>;

/* -------------------------------------------------------------------------- */
/*                                 Identifier                                 */
/* -------------------------------------------------------------------------- */

export const collectionIdentifierSchema = z.object({
  id: collectionIdSchema,
});

export type CollectionIdentifierInput = z.infer<
  typeof collectionIdentifierSchema
>;

/* -------------------------------------------------------------------------- */
/*                            Allocation preview                              */
/* -------------------------------------------------------------------------- */

export const allocationPreviewSchema = z.object({
  collectionId: collectionIdSchema,
  allocations: z
    .array(allocationLineSchema)
    .min(1, { error: "validation.allocation.linesRequired" }),
});

export type AllocationPreviewInput = z.infer<typeof allocationPreviewSchema>;

/* -------------------------------------------------------------------------- */
/*                                  Reversal                                  */
/* -------------------------------------------------------------------------- */

export const reversalSchema = z.object({
  id: collectionIdSchema,
  reversalReason: z
    .string()
    .trim()
    .min(1, { error: "validation.reversalReason.required" })
    .max(500, { error: "validation.reversalReason.maxLength" }),
});

export type ReversalInput = z.infer<typeof reversalSchema>;

/* -------------------------------------------------------------------------- */
/*                            Allocate / deallocate                           */
/* -------------------------------------------------------------------------- */

export const allocateCollectionSchema = z.object({
  collectionId: collectionIdSchema,
  allocations: z
    .array(allocationLineSchema)
    .min(1, { error: "validation.allocation.linesRequired" }),
});

export type AllocateCollectionInput = z.infer<typeof allocateCollectionSchema>;

export const deallocateCollectionSchema = z.object({
  collectionId: collectionIdSchema,
  allocationId: collectionIdSchema,
  reason: optionalTrimmed(z.string().max(500)).optional(),
});

export type DeallocateCollectionInput = z.infer<
  typeof deallocateCollectionSchema
>;
