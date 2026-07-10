import { z } from "zod";

export const divisionIdSchema = z.uuid({ error: "validation.id.invalid" });

export const listDistrictsByDivisionSchema = z.object({
  divisionId: divisionIdSchema,
  activeOnly: z.boolean().default(true),
});

export const listTerritoriesByDistrictSchema = z.object({
  districtId: z.uuid({ error: "validation.id.invalid" }),
  activeOnly: z.boolean().default(true),
});

export const searchTerritoriesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(160).optional(),
  divisionId: z.uuid({ error: "validation.id.invalid" }).optional(),
  districtId: z.uuid({ error: "validation.id.invalid" }).optional(),
  activeOnly: z.boolean().default(true),
});

export type ListDistrictsByDivisionInput = z.input<
  typeof listDistrictsByDivisionSchema
>;
export type ListTerritoriesByDistrictInput = z.input<
  typeof listTerritoriesByDistrictSchema
>;
export type SearchTerritoriesInput = z.input<typeof searchTerritoriesSchema>;
