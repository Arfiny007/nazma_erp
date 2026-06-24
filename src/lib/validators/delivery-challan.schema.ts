import { z } from "zod";
import { DeliveryMode } from "@prisma/client";

import {
  DELIVERY_CHALLAN_SORT_FIELDS,
  DELIVERY_CHALLAN_STATUSES,
} from "@/types/delivery-challan";

/**
 * Zod validation schemas for the Delivery Challan module.
 *
 * Validation contracts only — no business-rule enforcement (over-delivery,
 * order-status guards) lives here. Those rules are centralized in
 * `src/lib/delivery/workflow.ts` and invoked by server actions in a later
 * sub-phase.
 *
 * Every failure message is a localization key rather than a hard-coded string.
 */

/** Largest value representable by `@db.Decimal(18,2)` (16 integer digits). */
const DECIMAL_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;

/**
 * Validates a strictly-positive quantity fitting `Decimal(18,2)` and returns it
 * as a normalized decimal string.
 */
const quantitySchema = z
  .union([z.string(), z.number()], { error: "validation.quantity.required" })
  .transform((value) =>
    typeof value === "number" ? value.toString() : value.trim(),
  )
  .refine((value) => DECIMAL_PATTERN.test(value), {
    error: "validation.quantity.invalid",
  })
  .refine((value) => Number.parseFloat(value) > 0, {
    error: "validation.quantity.positive",
  });

const orderIdSchema = z.uuid({ error: "validation.id.invalid" });

const challanIdSchema = z.uuid({ error: "validation.id.invalid" });

const orderItemIdSchema = z.uuid({ error: "validation.orderItemId.invalid" });

/**
 * Builds a schema for an optional free-text field: empty strings and missing
 * values collapse to `null`, otherwise the trimmed value is validated.
 */
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

/** A single challan line — references an existing order item and a ship qty. */
const challanLineSchema = z.object({
  orderItemId: orderItemIdSchema,
  quantity: quantitySchema,
});

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

export const createDeliveryChallanSchema = z.object({
  orderId: orderIdSchema,
  items: z
    .array(challanLineSchema)
    .min(1, { error: "validation.challan.itemsRequired" }),
  deliveryMode: z.nativeEnum(DeliveryMode, {
    error: "validation.deliveryMode.invalid",
  }),
  vehicleNo: optionalTrimmed(
    z.string().max(32, { error: "validation.vehicleNo.tooLong" }),
  ),
  driverName: optionalTrimmed(
    z.string().max(120, { error: "validation.driverName.tooLong" }),
  ),
});

/* -------------------------------------------------------------------------- */
/*                                  Confirm                                   */
/* -------------------------------------------------------------------------- */

export const confirmDeliveryChallanSchema = z.object({
  id: challanIdSchema,
});

/* -------------------------------------------------------------------------- */
/*                                Identify / List                             */
/* -------------------------------------------------------------------------- */

export const deliveryChallanIdentifierSchema = z
  .object({
    id: challanIdSchema.optional(),
    challanNo: z
      .string()
      .trim()
      .regex(/^CHL-\d+$/, { error: "validation.challanNo.invalid" })
      .optional(),
  })
  .refine((data) => Boolean(data.id) || Boolean(data.challanNo), {
    error: "validation.identifier.required",
  });

export const listDeliveryChallansSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(160).optional(),
    orderId: orderIdSchema.optional(),
    dealerCode: z.string().trim().max(32).optional(),
    status: z.enum(DELIVERY_CHALLAN_STATUSES).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(DELIVERY_CHALLAN_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine(
    (data) => !(data.dateFrom && data.dateTo) || data.dateFrom <= data.dateTo,
    { error: "validation.dateRange.invalid", path: ["dateTo"] },
  );

/** Lists all challans for a single order (detail-page sub-list). */
export const listChallansForOrderSchema = z.object({
  orderId: orderIdSchema,
});

/* -------------------------------------------------------------------------- */
/*                              Inferred input types                          */
/* -------------------------------------------------------------------------- */

export type CreateDeliveryChallanInput = z.input<
  typeof createDeliveryChallanSchema
>;
export type CreateDeliveryChallanData = z.output<
  typeof createDeliveryChallanSchema
>;
export type ConfirmDeliveryChallanInput = z.input<
  typeof confirmDeliveryChallanSchema
>;
export type DeliveryChallanIdentifierInput = z.input<
  typeof deliveryChallanIdentifierSchema
>;
export type ListDeliveryChallansInput = z.input<
  typeof listDeliveryChallansSchema
>;
export type ListDeliveryChallansData = z.output<
  typeof listDeliveryChallansSchema
>;
export type ListChallansForOrderInput = z.input<
  typeof listChallansForOrderSchema
>;
