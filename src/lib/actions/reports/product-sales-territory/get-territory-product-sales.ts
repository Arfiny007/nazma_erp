"use server";

import {
  getTerritoryProductSalesReport,
  toTerritoryProductSalesReportDTO,
} from "@/lib/reports/product-sales-territory";
import { requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import { getTerritoryProductSalesSchema } from "@/lib/validators/product-sales-territory.schema";
import type {
  ActionResult,
  TerritoryProductSalesReportDTO,
} from "@/types/product-sales-territory";

import { fail, fromProductSalesError, fromZodError, ok } from "./helpers";

/**
 * Territory-wise product sales report — PHASE_12B / ADR-061.
 * Read-only; Sold Quantity = SUM(InvoiceItem.quantity) for eligible invoices.
 */
export async function getTerritoryProductSales(
  input: unknown = {},
): Promise<ActionResult<TerritoryProductSalesReportDTO>> {
  let user;
  try {
    user = await requirePermission("reports:territory-product-sales:view");
  } catch {
    return fail<TerritoryProductSalesReportDTO>(
      "FORBIDDEN",
      "rbac.noAccess",
    );
  }

  const parsed = getTerritoryProductSalesSchema.safeParse(input);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const scope = await buildTerritoryScope(user.id);

  try {
    const result = await getTerritoryProductSalesReport(parsed.data, scope);
    return ok(toTerritoryProductSalesReportDTO(result));
  } catch (error) {
    return fromProductSalesError(error);
  }
}
