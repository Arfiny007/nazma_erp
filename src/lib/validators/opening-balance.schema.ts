import { z } from "zod";

/**
 * Zod validation schemas for the Financial Initialization Platform
 * (Opening Balance workflow — PHASE_07C).
 *
 * Structural validation only. Business rules (dealer existence, uniqueness,
 * state transitions, decimal precision) are enforced in
 * `opening-balance-validation.ts` and the service/engine layers.
 */

const dealerCodeSchema = z
  .string()
  .trim()
  .min(1, { error: "validation.dealerCode.required" });

const openingBalanceIdSchema = z.uuid({ error: "validation.id.invalid" });

/** Signed decimal string, at most 2 fractional digits — matches `Decimal(18,2)`. */
const amountSchema = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d{1,2})?$/, { error: "openingBalance.validation.amountFormat" })
  .refine((value) => Number.isFinite(Number(value)), {
    error: "openingBalance.validation.amountFormat",
  });

export const createOpeningBalanceDraftSchema = z.object({
  dealerCode: dealerCodeSchema,
  amount: amountSchema,
  effectiveDate: z.coerce.date({ error: "openingBalance.validation.effectiveDateInvalid" }),
  remarks: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export type CreateOpeningBalanceDraftInput = z.infer<
  typeof createOpeningBalanceDraftSchema
>;

export const openingBalanceIdentifierSchema = z.object({
  id: openingBalanceIdSchema,
});

export type OpeningBalanceIdentifierInput = z.infer<
  typeof openingBalanceIdentifierSchema
>;

export const getInitializationStatusSchema = z.object({
  dealerCode: dealerCodeSchema,
});

export type GetInitializationStatusInput = z.infer<
  typeof getInitializationStatusSchema
>;

export const listUninitializedDealersSchema = z.object({
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListUninitializedDealersInput = z.infer<
  typeof listUninitializedDealersSchema
>;
