"use server";

import {
  getTopSellingProductsByTerritory as getTopSellingProductsRead,
  toTopSellingProductsChartDTO,
} from "@/lib/reports/product-sales-territory";
import { requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import { getTopSellingProductsSchema } from "@/lib/validators/product-sales-territory.schema";
import type {
  ActionResult,
  TopSellingProductsChartDTO,
} from "@/types/product-sales-territory";

import { fail, fromProductSalesError, fromZodError, ok } from "./helpers";

/**
 * Top-selling products chart data — PHASE_12B / ADR-061.
 * Shared with dashboard analytics; ranks InvoiceItem sold quantity only.
 */
export async function getTopSellingProductsByTerritory(
  input: unknown = {},
): Promise<ActionResult<TopSellingProductsChartDTO>> {
  let user;
  try {
    user = await requirePermission("reports:territory-product-sales:view");
  } catch {
    return fail<TopSellingProductsChartDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const parsed = getTopSellingProductsSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const scope = await buildTerritoryScope(user.id);

  try {
    const result = await getTopSellingProductsRead(parsed.data, scope);
    return ok(toTopSellingProductsChartDTO(result));
  } catch (error) {
    return fromProductSalesError(error);
  }
}
