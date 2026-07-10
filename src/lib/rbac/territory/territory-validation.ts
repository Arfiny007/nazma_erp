import { z } from "zod";

export const assignTerritorySchema = z.object({
  userId: z.uuid({ error: "validation.id.invalid" }),
  territoryId: z.uuid({ error: "validation.id.invalid" }),
  isPrimary: z.boolean().default(false),
});

export const revokeTerritoryAssignmentSchema = z.object({
  assignmentId: z.cuid({ error: "validation.id.invalid" }),
});

export const listUserTerritoriesSchema = z.object({
  userId: z.uuid({ error: "validation.id.invalid" }),
});

export const searchAssignableUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(160).optional(),
});

export const searchAssignableTerritoriesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(160).optional(),
});

export type AssignTerritoryInput = z.input<typeof assignTerritorySchema>;
export type RevokeTerritoryAssignmentInput = z.input<
  typeof revokeTerritoryAssignmentSchema
>;
export type ListUserTerritoriesInput = z.input<typeof listUserTerritoriesSchema>;
export type SearchAssignableUsersInput = z.input<
  typeof searchAssignableUsersSchema
>;
export type SearchAssignableTerritoriesInput = z.input<
  typeof searchAssignableTerritoriesSchema
>;
