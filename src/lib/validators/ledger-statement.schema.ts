import { z } from "zod";

/**
 * Zod validation schemas for the Dealer Subledger Foundation — PHASE_07D1.
 *
 * Validation contracts only. Dealer existence, date-range ordering, and
 * ledger consistency are validated by `src/lib/ledger/statement/
 * statement-validation.ts` against actual data — these schemas only shape
 * and bound the raw server action input.
 */

const dealerCodeSchema = z
  .string()
  .trim()
  .min(1, { error: "validation.dealerCode.required" });

export const getDealerStatementSchema = z.object({
  dealerCode: dealerCodeSchema,
  fromDate: z.coerce.date({ error: "validation.fromDate.invalid" }).optional(),
  toDate: z.coerce.date({ error: "validation.toDate.invalid" }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type GetDealerStatementInput = z.infer<typeof getDealerStatementSchema>;

export const getDealerStatementSummarySchema = z.object({
  dealerCode: dealerCodeSchema,
  fromDate: z.coerce.date({ error: "validation.fromDate.invalid" }).optional(),
  toDate: z.coerce.date({ error: "validation.toDate.invalid" }).optional(),
});

export type GetDealerStatementSummaryInput = z.infer<
  typeof getDealerStatementSummarySchema
>;
