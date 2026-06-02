import { z } from "zod";

import { PRODUCT_SORT_FIELDS } from "@/types/product";

/**
 * Zod validation schemas for the Product catalog module.
 *
 * Every failure message is a localization key (e.g. `validation.sku.invalid`)
 * rather than a hard-coded human string, so the UI layer can translate it.
 */

/** Largest value representable by `@db.Decimal(18,2)` (16 integer digits). */
const MONEY_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;

/**
 * Stock keeping units and model numbers are uppercase, alphanumeric tokens that
 * may contain internal hyphens (e.g. "FV-222", "FV-223-C", "OVP6-507").
 */
const CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

/**
 * Validates a non-negative monetary amount fitting `Decimal(18,2)` and returns
 * it as a normalized decimal string suitable for Prisma.
 */
export const moneyNonNegativeSchema = z
  .union([z.string(), z.number()], {
    error: "validation.money.required",
  })
  .transform((value) =>
    typeof value === "number" ? value.toString() : value.trim(),
  )
  .refine((value) => MONEY_PATTERN.test(value), {
    error: "validation.money.invalid",
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

const skuSchema = z
  .string({ error: "validation.sku.required" })
  .trim()
  .min(2, { error: "validation.sku.tooShort" })
  .max(64, { error: "validation.sku.tooLong" })
  .transform((value) => value.toUpperCase())
  .refine((value) => CODE_PATTERN.test(value), {
    error: "validation.sku.invalid",
  });

const modelNumberSchema = z
  .string({ error: "validation.modelNumber.required" })
  .trim()
  .min(2, { error: "validation.modelNumber.tooShort" })
  .max(64, { error: "validation.modelNumber.tooLong" })
  .transform((value) => value.toUpperCase())
  .refine((value) => CODE_PATTERN.test(value), {
    error: "validation.modelNumber.invalid",
  });

const nameSchema = z
  .string({ error: "validation.name.required" })
  .trim()
  .min(2, { error: "validation.name.tooShort" })
  .max(160, { error: "validation.name.tooLong" });

const nameBnSchema = optionalTrimmed(
  z.string().min(2, { error: "validation.nameBn.tooShort" }).max(160, {
    error: "validation.nameBn.tooLong",
  }),
);

const categoryIdSchema = z.uuid({ error: "validation.categoryId.invalid" });

const unitSchema = z
  .string({ error: "validation.unit.required" })
  .trim()
  .min(1, { error: "validation.unit.required" })
  .max(16, { error: "validation.unit.tooLong" })
  .default("PCS");

const descriptionSchema = optionalTrimmed(
  z.string().max(1000, { error: "validation.description.tooLong" }),
);

/* -------------------------------------------------------------------------- */
/*                                Create / Update                             */
/* -------------------------------------------------------------------------- */

export const createProductSchema = z.object({
  sku: skuSchema,
  modelNumber: modelNumberSchema,
  name: nameSchema,
  nameBn: nameBnSchema,
  categoryId: categoryIdSchema,
  unit: unitSchema,
  description: descriptionSchema,
  currentPrice: moneyNonNegativeSchema,
  isActive: z.boolean().default(true),
});

/**
 * Update accepts a partial set of editable fields keyed by product id. The
 * `createdAt` timestamp is intentionally immutable through this schema.
 */
export const updateProductSchema = z
  .object({
    id: z.uuid({ error: "validation.id.invalid" }),
    sku: skuSchema.optional(),
    modelNumber: modelNumberSchema.optional(),
    name: nameSchema.optional(),
    nameBn: nameBnSchema.optional(),
    categoryId: categoryIdSchema.optional(),
    unit: unitSchema.optional(),
    description: descriptionSchema.optional(),
    currentPrice: moneyNonNegativeSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      Object.keys(data).some(
        (key) => key !== "id" && data[key as keyof typeof data] !== undefined,
      ),
    { error: "validation.update.empty" },
  );

/* -------------------------------------------------------------------------- */
/*                                Identify / List                             */
/* -------------------------------------------------------------------------- */

export const productIdentifierSchema = z
  .object({
    id: z.uuid({ error: "validation.id.invalid" }).optional(),
    sku: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .optional(),
    modelNumber: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .optional(),
  })
  .refine(
    (data) => Boolean(data.id) || Boolean(data.sku) || Boolean(data.modelNumber),
    { error: "validation.identifier.required" },
  );

export const listProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(160).optional(),
  categoryId: z.uuid({ error: "validation.categoryId.invalid" }).optional(),
  isActive: z.boolean().optional(),
  sortBy: z.enum(PRODUCT_SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/* -------------------------------------------------------------------------- */
/*                              Inferred input types                          */
/* -------------------------------------------------------------------------- */

export type CreateProductInput = z.input<typeof createProductSchema>;
export type CreateProductData = z.output<typeof createProductSchema>;
export type UpdateProductInput = z.input<typeof updateProductSchema>;
export type UpdateProductData = z.output<typeof updateProductSchema>;
export type ProductIdentifierInput = z.input<typeof productIdentifierSchema>;
export type ListProductsInput = z.input<typeof listProductsSchema>;
export type ListProductsData = z.output<typeof listProductsSchema>;
