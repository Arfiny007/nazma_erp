import { z } from "zod";
import { InvoiceStatus } from "@prisma/client";

import { INVOICE_SORT_FIELDS } from "@/types/invoice";

/**
 * Zod validation schemas for the Invoice Engine module.
 *
 * Business rules (challan status, credit limit, duplicate invoice) are enforced
 * in workflow guards and server actions — not here.
 */

const invoiceIdSchema = z.uuid({ error: "validation.id.invalid" });
const challanIdSchema = z.uuid({ error: "validation.id.invalid" });

export const issueInvoiceSchema = z.object({
  deliveryChallanId: challanIdSchema,
});

export type IssueInvoiceInput = z.infer<typeof issueInvoiceSchema>;

export const invoiceIdentifierSchema = z.object({
  id: invoiceIdSchema,
});

export type InvoiceIdentifierInput = z.infer<typeof invoiceIdentifierSchema>;

const sortOrderSchema = z.enum(["asc", "desc"], {
  error: "validation.sortOrder.invalid",
});

export const listInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  dealerCode: z.string().trim().min(1).optional(),
  orderId: z.uuid({ error: "validation.id.invalid" }).optional(),
  deliveryChallanId: z.uuid({ error: "validation.id.invalid" }).optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(INVOICE_SORT_FIELDS).default("issueDate"),
  sortOrder: sortOrderSchema.default("desc"),
});

export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;

export const previewInvoiceFromChallanSchema = z.object({
  deliveryChallanId: challanIdSchema,
});

export type PreviewInvoiceFromChallanInput = z.infer<
  typeof previewInvoiceFromChallanSchema
>;

export const listInvoiceEligibleChallansSchema = z.object({
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListInvoiceEligibleChallansInput = z.infer<
  typeof listInvoiceEligibleChallansSchema
>;
