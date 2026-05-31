import { z } from "zod";

import { DEALER_SORT_FIELDS } from "@/types/dealer";

/**
 * Zod validation schemas for the Dealer Management module.
 *
 * Every failure message is a localization key (e.g. `validation.mobile.invalid`)
 * rather than a hard-coded human string, so the UI layer can translate it.
 */

/** Largest value representable by `@db.Decimal(18,2)` (16 integer digits). */
const MONEY_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;

/**
 * Accepts a Bangladeshi mobile number in local (`01712345678`) or international
 * (`+8801712345678` / `8801712345678`) form and normalizes it to the canonical
 * local form `01XXXXXXXXX`.
 */
const MOBILE_PATTERN = /^(?:\+?880|0)1[3-9]\d{8}$/;

export const mobileSchema = z
  .string({ error: "validation.mobile.required" })
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine((value) => MOBILE_PATTERN.test(value), {
    error: "validation.mobile.invalid",
  })
  .transform((value) => value.replace(/^(?:\+?880)/, "0"));

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

const companyNameSchema = z
  .string({ error: "validation.companyName.required" })
  .trim()
  .min(2, { error: "validation.companyName.tooShort" })
  .max(160, { error: "validation.companyName.tooLong" });

const proprietorNameSchema = optionalTrimmed(
  z
    .string()
    .min(2, { error: "validation.proprietorName.tooShort" })
    .max(120, { error: "validation.proprietorName.tooLong" }),
);

const emailSchema = optionalTrimmed(
  z.email({ error: "validation.email.invalid" }).max(160, {
    error: "validation.email.tooLong",
  }),
);

const addressSchema = z
  .string({ error: "validation.address.required" })
  .trim()
  .min(3, { error: "validation.address.tooShort" })
  .max(255, { error: "validation.address.tooLong" });

const districtSchema = z
  .string({ error: "validation.district.required" })
  .trim()
  .min(2, { error: "validation.district.tooShort" })
  .max(100, { error: "validation.district.tooLong" });

const territorySchema = z
  .string({ error: "validation.territory.required" })
  .trim()
  .min(1, { error: "validation.territory.required" })
  .max(100, { error: "validation.territory.tooLong" });

/* -------------------------------------------------------------------------- */
/*                                Create / Update                             */
/* -------------------------------------------------------------------------- */

export const createDealerSchema = z.object({
  companyName: companyNameSchema,
  proprietorName: proprietorNameSchema,
  mobile: mobileSchema,
  email: emailSchema,
  address: addressSchema,
  district: districtSchema,
  territory: territorySchema,
  creditLimit: moneyNonNegativeSchema,
  isActive: z.boolean().default(true),
});

/**
 * Update accepts a partial set of editable fields keyed by dealer id. The
 * system-generated `dealerCode` and the financially-derived `currentBalance`
 * are intentionally immutable through this schema.
 */
export const updateDealerSchema = z
  .object({
    id: z.uuid({ error: "validation.id.invalid" }),
    companyName: companyNameSchema.optional(),
    proprietorName: proprietorNameSchema.optional(),
    mobile: mobileSchema.optional(),
    email: emailSchema.optional(),
    address: addressSchema.optional(),
    district: districtSchema.optional(),
    territory: territorySchema.optional(),
    creditLimit: moneyNonNegativeSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      Object.keys(data).some((key) => key !== "id" && data[key as keyof typeof data] !== undefined),
    { error: "validation.update.empty" },
  );

/* -------------------------------------------------------------------------- */
/*                                Identify / List                             */
/* -------------------------------------------------------------------------- */

export const dealerIdentifierSchema = z
  .object({
    id: z.uuid({ error: "validation.id.invalid" }).optional(),
    dealerCode: z
      .string()
      .trim()
      .regex(/^DLR-\d+$/, { error: "validation.dealerCode.invalid" })
      .optional(),
  })
  .refine((data) => Boolean(data.id) || Boolean(data.dealerCode), {
    error: "validation.identifier.required",
  });

export const listDealersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(160).optional(),
  district: z.string().trim().max(100).optional(),
  territory: z.string().trim().max(100).optional(),
  isActive: z.boolean().optional(),
  sortBy: z.enum(DEALER_SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/* -------------------------------------------------------------------------- */
/*                              Inferred input types                          */
/* -------------------------------------------------------------------------- */

export type CreateDealerInput = z.input<typeof createDealerSchema>;
export type CreateDealerData = z.output<typeof createDealerSchema>;
export type UpdateDealerInput = z.input<typeof updateDealerSchema>;
export type UpdateDealerData = z.output<typeof updateDealerSchema>;
export type DealerIdentifierInput = z.input<typeof dealerIdentifierSchema>;
export type ListDealersInput = z.input<typeof listDealersSchema>;
export type ListDealersData = z.output<typeof listDealersSchema>;
