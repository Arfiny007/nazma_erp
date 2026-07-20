import { z } from "zod";

import { SR_PERFORMANCE_PAGE_SIZES } from "@/lib/reports/sr-performance";

const optionalUuid = z
  .union([z.string().uuid(), z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    return value;
  });

/**
 * Accept date-only strings or Date instances. Coercion to Date is deferred to
 * normalizeFilters / parseLocalDateOnly so timezone shifting is avoided.
 */
const dateInput = z
  .union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.string().datetime(),
    z.date(),
  ])
  .optional();

const pageSizeSchema = z.coerce
  .number()
  .int()
  .refine(
    (value): value is (typeof SR_PERFORMANCE_PAGE_SIZES)[number] =>
      (SR_PERFORMANCE_PAGE_SIZES as readonly number[]).includes(value),
    { message: "srPerformance.error.invalidPagination" },
  )
  .default(25);

export const srPerformancePrintModeSchema = z.enum(["individual", "overview"]);

export const srPerformanceFiltersSchema = z.object({
  from: dateInput,
  to: dateInput,
  territoryId: optionalUuid,
  srId: optionalUuid,
  srSearch: z.string().trim().max(120).optional().default(""),
  partySearch: z.string().trim().max(120).optional().default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: pageSizeSchema,
  mode: srPerformancePrintModeSchema.optional().nullable(),
});

export const getSrPerformanceOverviewSchema = srPerformanceFiltersSchema;
export const getSrDealerStatementSchema = srPerformanceFiltersSchema;
export const getSrPerformancePrintPayloadSchema = srPerformanceFiltersSchema
  .omit({
    page: true,
    pageSize: true,
  })
  .extend({
    mode: srPerformancePrintModeSchema,
  });

export type SrPerformanceFiltersInput = z.infer<typeof srPerformanceFiltersSchema>;
