"use server";

import { getProductSalesFilterOptions as getFilterOptionsRead } from "@/lib/reports/product-sales-territory";
import { requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import type {
  ActionResult,
  ProductSalesFilterOptionsDTO,
} from "@/types/product-sales-territory";

import { fail, fromProductSalesError, ok } from "./helpers";

/**
 * Filter option lists for Territory Product Sales — PHASE_12B.
 */
export async function getProductSalesFilterOptions(input?: {
  categoryId?: string | null;
  productSearch?: string;
}): Promise<ActionResult<ProductSalesFilterOptionsDTO>> {
  let user;
  try {
    user = await requirePermission("reports:territory-product-sales:view");
  } catch {
    return fail<ProductSalesFilterOptionsDTO>("FORBIDDEN", "rbac.noAccess");
  }

  const scope = await buildTerritoryScope(user.id);

  try {
    const result = await getFilterOptionsRead(scope, {
      categoryId: input?.categoryId,
      productSearch: input?.productSearch,
    });
    return ok(result);
  } catch (error) {
    return fromProductSalesError(error);
  }
}
