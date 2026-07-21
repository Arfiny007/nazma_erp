import { Suspense } from "react";

import { enforcePermission, requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import {
  EmptyTerritoryScopeError,
  getTerritoryProductSalesPrintPayload,
  parseTerritoryProductSalesFilters,
  TerritoryOutOfScopeError,
  toTerritoryProductSalesPrintPayloadDTO,
} from "@/lib/reports/product-sales-territory";
import type { TerritoryProductSalesPrintPayloadDTO } from "@/types/product-sales-territory";

import { ProductSalesPrintPageClient } from "./page-client";

interface PrintPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductSalesPrintPage({
  searchParams,
}: PrintPageProps) {
  await enforcePermission("reports:territory-product-sales:view");
  const user = await requirePermission("reports:territory-product-sales:view");
  const scope = await buildTerritoryScope(user.id);

  const params = await searchParams;
  const filters = parseTerritoryProductSalesFilters(params);

  let payload: TerritoryProductSalesPrintPayloadDTO | null = null;
  let errorKey: string | null = null;

  if (!filters.mode) {
    errorKey = "productSales.error.printModeRequired";
  } else {
    try {
      const result = await getTerritoryProductSalesPrintPayload(
        {
          from: filters.from,
          to: filters.to,
          territoryId: filters.territoryId,
          productId: filters.productId,
          categoryId: filters.categoryId,
          productSearch: filters.productSearch,
          view: filters.view,
          sort: filters.sort,
          mode: filters.mode,
        },
        scope,
        user.role,
      );
      payload = toTerritoryProductSalesPrintPayloadDTO(result);
    } catch (error) {
      if (error instanceof EmptyTerritoryScopeError) {
        errorKey = "productSales.error.emptyTerritoryScope";
      } else if (error instanceof TerritoryOutOfScopeError) {
        errorKey = "productSales.error.territoryOutOfScope";
      } else {
        errorKey = "productSales.error.generic";
      }
      payload = null;
    }
  }

  return (
    <Suspense>
      <ProductSalesPrintPageClient payload={payload} errorKey={errorKey} />
    </Suspense>
  );
}
