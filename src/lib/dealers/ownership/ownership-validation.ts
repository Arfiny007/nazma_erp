import { z } from "zod";

export const assignDealerTerritorySchema = z.object({
  dealerId: z.uuid({ error: "validation.id.invalid" }),
  territoryId: z.uuid({ error: "validation.territory.required" }),
  assignedSrId: z.uuid({ error: "validation.id.invalid" }).nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
});

export const transferDealerSchema = z.object({
  dealerId: z.uuid({ error: "validation.id.invalid" }),
  territoryId: z.uuid({ error: "validation.territory.required" }),
  assignedSrId: z.uuid({ error: "validation.id.invalid" }).nullable().optional(),
  reason: z
    .string({ error: "dealer.ownership.reason.required" })
    .trim()
    .min(2, { error: "dealer.ownership.reason.required" })
    .max(500),
});

export const dealerOwnershipHistorySchema = z.object({
  dealerId: z.uuid({ error: "validation.id.invalid" }),
});

export const dealerGeographySchema = z.object({
  divisionId: z.uuid({ error: "validation.division.required" }),
  districtId: z.uuid({ error: "validation.district.required" }),
  territoryId: z.uuid({ error: "validation.territory.required" }),
});

export type AssignDealerTerritorySchemaInput = z.infer<
  typeof assignDealerTerritorySchema
>;
export type TransferDealerSchemaInput = z.infer<typeof transferDealerSchema>;
export type DealerGeographyInput = z.infer<typeof dealerGeographySchema>;
