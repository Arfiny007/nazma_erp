import { z } from "zod";
import { OrderStatus } from "@prisma/client";

import { ORDER_SORT_FIELDS } from "@/types/order";

/**
 * Zod validation schemas for the Sales Order module.
 *
 * Every failure message is a localization key (e.g. `validation.quantity.invalid`)
 * rather than a hard-coded human string, so the UI layer can translate it.
 *
 * Monetary and quantity values are normalized to decimal strings suitable for
 * Prisma's `Decimal` columns; no floating-point math is performed.
 */

/** Largest value representable by `@db.Decimal(18,2)` (16 integer digits). */
const MONEY_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;

/** Dealer code canonical format, e.g. `DLR-0001`. */
const DEALER_CODE_PATTERN = /^DLR-\d+$/;

/**
 * Validates a non-negative monetary amount fitting `Decimal(18,2)` and returns
 * it as a normalized decimal string suitable for Prisma.
 */
const moneyNonNegativeSchema = z
  .union([z.string(), z.number()], { error: "validation.money.required" })
  .transform((value) =>
    typeof value === "number" ? value.toString() : value.trim(),
  )
  .refine((value) => MONEY_PATTERN.test(value), {
    error: "validation.money.invalid",
  });

/**
 * Validates a strictly-positive quantity fitting `Decimal(18,2)` and returns it
 * as a normalized decimal string.
 */
const quantitySchema = z
  .union([z.string(), z.number()], { error: "validation.quantity.required" })
  .transform((value) =>
    typeof value === "number" ? value.toString() : value.trim(),
  )
  .refine((value) => MONEY_PATTERN.test(value), {
    error: "validation.quantity.invalid",
  })
  .refine((value) => Number.parseFloat(value) > 0, {
    error: "validation.quantity.positive",
  });

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

const dealerCodeSchema = z
  .string({ error: "validation.dealerCode.required" })
  .trim()
  .regex(DEALER_CODE_PATTERN, { error: "validation.dealerCode.invalid" });

/** Project id is a CUID (Project model uses `@default(cuid())`). */
const projectIdSchema = z
  .string({ error: "validation.projectId.invalid" })
  .trim()
  .min(1, { error: "validation.projectId.invalid" })
  .max(64, { error: "validation.projectId.invalid" });

const productIdSchema = z.uuid({ error: "validation.productId.invalid" });

const orderIdSchema = z.uuid({ error: "validation.id.invalid" });

/** Inline project payload — used when an order creates its project on the fly. */
const inlineProjectSchema = z.object({
  name: z
    .string({ error: "validation.projectName.required" })
    .trim()
    .min(2, { error: "validation.projectName.tooShort" })
    .max(160, { error: "validation.projectName.tooLong" }),
  address: optionalTrimmed(
    z.string().max(255, { error: "validation.address.tooLong" }),
  ),
  contactName: optionalTrimmed(
    z.string().max(120, { error: "validation.contactName.tooLong" }),
  ),
  contactPhone: optionalTrimmed(
    z.string().max(32, { error: "validation.contactPhone.tooLong" }),
  ),
});

/** A single order line on input. `unitPrice` defaults to the product price. */
const orderItemSchema = z.object({
  productId: productIdSchema,
  quantity: quantitySchema,
  unitPrice: moneyNonNegativeSchema.optional(),
  discount: moneyNonNegativeSchema.optional(),
});

/** Status values an order may be placed into directly by create/update. */
const writableStatusSchema = z.enum([
  OrderStatus.Draft,
  OrderStatus.Pending_Approval,
]);

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

export const createOrderSchema = z
  .object({
    dealerCode: dealerCodeSchema,
    projectId: projectIdSchema.optional(),
    project: inlineProjectSchema.optional(),
    items: z
      .array(orderItemSchema)
      .min(1, { error: "validation.order.itemsRequired" }),
    status: writableStatusSchema.default(OrderStatus.Draft),
  })
  .refine((data) => !(data.projectId && data.project), {
    error: "validation.project.ambiguous",
    path: ["projectId"],
  });

/* -------------------------------------------------------------------------- */
/*                                   Update                                   */
/* -------------------------------------------------------------------------- */

export const updateOrderSchema = z
  .object({
    id: orderIdSchema,
    dealerCode: dealerCodeSchema.optional(),
    projectId: projectIdSchema.nullable().optional(),
    project: inlineProjectSchema.optional(),
    items: z
      .array(orderItemSchema)
      .min(1, { error: "validation.order.itemsRequired" })
      .optional(),
    status: writableStatusSchema.optional(),
  })
  .refine((data) => !(data.projectId && data.project), {
    error: "validation.project.ambiguous",
    path: ["projectId"],
  })
  .refine(
    (data) =>
      Object.keys(data).some(
        (key) => key !== "id" && data[key as keyof typeof data] !== undefined,
      ),
    { error: "validation.update.empty" },
  );

/* -------------------------------------------------------------------------- */
/*                          Approve / Reject / Cancel                         */
/* -------------------------------------------------------------------------- */

export const approveOrderSchema = z.object({
  id: orderIdSchema,
});

export const rejectOrderSchema = z.object({
  id: orderIdSchema,
  reason: optionalTrimmed(
    z.string().max(500, { error: "validation.reason.tooLong" }),
  ),
});

export const cancelOrderSchema = z.object({
  id: orderIdSchema,
  reason: optionalTrimmed(
    z.string().max(500, { error: "validation.reason.tooLong" }),
  ),
});

/* -------------------------------------------------------------------------- */
/*                                Identify / List                             */
/* -------------------------------------------------------------------------- */

export const orderIdentifierSchema = z
  .object({
    id: orderIdSchema.optional(),
    orderNo: z
      .string()
      .trim()
      .regex(/^ORD-\d+$/, { error: "validation.orderNo.invalid" })
      .optional(),
  })
  .refine((data) => Boolean(data.id) || Boolean(data.orderNo), {
    error: "validation.identifier.required",
  });

export const listOrdersSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(160).optional(),
    dealerCode: z.string().trim().max(32).optional(),
    projectId: projectIdSchema.optional(),
    status: z.enum(OrderStatus).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(ORDER_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine(
    (data) => !(data.dateFrom && data.dateTo) || data.dateFrom <= data.dateTo,
    { error: "validation.dateRange.invalid", path: ["dateTo"] },
  );

/* -------------------------------------------------------------------------- */
/*                          Live financial preview (UI)                       */
/* -------------------------------------------------------------------------- */

/** A single line fed to the live total preview; price is always explicit. */
const previewLineSchema = z.object({
  quantity: quantitySchema,
  unitPrice: moneyNonNegativeSchema,
});

/** Order-level discount expressed as a percentage in the range 0–100. */
const discountPercentSchema = z
  .union([z.string(), z.number()], { error: "validation.discountPercent.invalid" })
  .transform((value) =>
    typeof value === "number" ? value.toString() : value.trim(),
  )
  .refine((value) => /^\d{1,3}(\.\d{1,2})?$/.test(value), {
    error: "validation.discountPercent.invalid",
  })
  .refine((value) => Number.parseFloat(value) <= 100, {
    error: "validation.discountPercent.range",
  });

/**
 * Input to {@link previewOrderTotals}. All monetary arithmetic is performed by
 * the server-side calculation engine; the client only supplies raw quantities,
 * unit prices, and an optional order-level discount percentage.
 */
export const previewOrderTotalsSchema = z.object({
  items: z.array(previewLineSchema).min(1, { error: "validation.order.itemsRequired" }),
  discountPercent: discountPercentSchema.optional(),
});

/** Identifies the dealer whose projects should be listed (by dealer code). */
export const dealerProjectsSchema = z.object({
  dealerCode: dealerCodeSchema,
});

/* -------------------------------------------------------------------------- */
/*                              Inferred input types                          */
/* -------------------------------------------------------------------------- */

export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type CreateOrderData = z.output<typeof createOrderSchema>;
export type UpdateOrderInput = z.input<typeof updateOrderSchema>;
export type UpdateOrderData = z.output<typeof updateOrderSchema>;
export type ApproveOrderInput = z.input<typeof approveOrderSchema>;
export type RejectOrderInput = z.input<typeof rejectOrderSchema>;
export type CancelOrderInput = z.input<typeof cancelOrderSchema>;
export type OrderIdentifierInput = z.input<typeof orderIdentifierSchema>;
export type ListOrdersInput = z.input<typeof listOrdersSchema>;
export type ListOrdersData = z.output<typeof listOrdersSchema>;
export type PreviewOrderTotalsInput = z.input<typeof previewOrderTotalsSchema>;
export type DealerProjectsInput = z.input<typeof dealerProjectsSchema>;
