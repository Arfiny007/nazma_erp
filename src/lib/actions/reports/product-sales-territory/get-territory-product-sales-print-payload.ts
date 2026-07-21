"use server";

import {
  getTerritoryProductSalesPrintPayload as getTerritoryProductSalesPrintPayloadRead,
  toTerritoryProductSalesPrintPayloadDTO,
} from "@/lib/reports/product-sales-territory";
import { requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import { getTerritoryProductSalesPrintPayloadSchema } from "@/lib/validators/product-sales-territory.schema";
import type {
  ActionResult,
  TerritoryProductSalesPrintPayloadDTO,
} from "@/types/product-sales-territory";

import { fail, fromProductSalesError, fromZodError, ok } from "./helpers";

/**
 * Territory Product Sales print payload — PHASE_12B.2.
 * Reuses certified report service + Territory RBAC. No separate SQL.
 */
export async function getTerritoryProductSalesPrintPayload(
  input: unknown = {},
): Promise<ActionResult<TerritoryProductSalesPrintPayloadDTO>> {
  let user;
  try {
    user = await requirePermission("reports:territory-product-sales:view");
  } catch {
    return fail<TerritoryProductSalesPrintPayloadDTO>(
      "FORBIDDEN",
      "rbac.noAccess",
    );
  }

  const parsed = getTerritoryProductSalesPrintPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const scope = await buildTerritoryScope(user.id);

  try {
    const result = await getTerritoryProductSalesPrintPayloadRead(
      parsed.data,
      scope,
      user.role,
    );
    return ok(toTerritoryProductSalesPrintPayloadDTO(result));
  } catch (error) {
    return fromProductSalesError(error);
  }
}
