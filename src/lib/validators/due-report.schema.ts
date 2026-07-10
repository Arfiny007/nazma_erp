import { z } from "zod";

const agingBucketSchema = z.enum([
  "current",
  "days30",
  "days60",
  "days90",
  "days90Plus",
]);

const territoryGroupBySchema = z.enum(["division", "district", "territory"]);

const optionalUuid = z.string().uuid().optional();

const optionalDate = z
  .union([z.string().datetime(), z.coerce.date()])
  .optional()
  .transform((value) => (value === undefined ? undefined : new Date(value)));

const optionalDecimalString = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, "validation.decimal.invalid")
  .optional();

const geographyFilters = {
  divisionId: optionalUuid,
  districtId: optionalUuid,
  territoryId: optionalUuid,
  assignedSrId: optionalUuid,
  fromDate: optionalDate,
  toDate: optionalDate,
};

export const getDueReportSchema = z.object({
  ...geographyFilters,
  dealerCode: z.string().trim().min(1).optional(),
  agingBucket: agingBucketSchema.optional(),
  balanceMin: optionalDecimalString,
  balanceMax: optionalDecimalString,
  includeZeroBalance: z.boolean().optional().default(false),
  includeAdvance: z.boolean().optional().default(true),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
});

export const getTerritoryDueReportSchema = z.object({
  groupBy: territoryGroupBySchema.default("territory"),
  ...geographyFilters,
});

export const getSrDueReportSchema = z.object({
  ...geographyFilters,
});

export const getCompanyDueSummarySchema = z.object({
  ...geographyFilters,
});

export const getDueAgingReportSchema = z.object({
  ...geographyFilters,
  dealerCode: z.string().trim().min(1).optional(),
  asOfDate: optionalDate,
});

export type GetDueReportInput = z.infer<typeof getDueReportSchema>;
export type GetTerritoryDueReportInput = z.infer<typeof getTerritoryDueReportSchema>;
export type GetSrDueReportInput = z.infer<typeof getSrDueReportSchema>;
export type GetCompanyDueSummaryInput = z.infer<typeof getCompanyDueSummarySchema>;
export type GetDueAgingReportInput = z.infer<typeof getDueAgingReportSchema>;
