import { Suspense } from "react";

import { enforcePermission, requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import {
  formatLocalDateOnly,
  getProductSalesFilterOptions,
  getTerritoryProductSalesReport,
  parseTerritoryProductSalesFilters,
  toTerritoryProductSalesReportDTO,
} from "@/lib/reports/product-sales-territory";
import type {
  ProductSalesFilterOptionsDTO,
  ProductSalesFiltersDTO,
  TerritoryProductSalesReportDTO,
} from "@/types/product-sales-territory";

import { ProductSalesPageClient } from "./page-client";

interface ProductSalesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductSalesByTerritoryPage({
  searchParams,
}: ProductSalesPageProps) {
  await enforcePermission("reports:territory-product-sales:view");
  const user = await requirePermission("reports:territory-product-sales:view");
  const scope = await buildTerritoryScope(user.id);

  const params = await searchParams;
  const filters = parseTerritoryProductSalesFilters(params);

  const filterInput = {
    from: filters.from,
    to: filters.to,
    territoryId: filters.territoryId,
    productId: filters.productId,
    categoryId: filters.categoryId,
    productSearch: filters.productSearch,
    view: filters.view,
    sort: filters.sort,
    page: filters.page,
    pageSize: filters.pageSize,
    limit: filters.limit,
  };

  let report: TerritoryProductSalesReportDTO | null = null;
  let options: ProductSalesFilterOptionsDTO = {
    territories: [],
    categories: [],
    products: [],
  };
  let errorKey: string | null = null;

  try {
    const [reportResult, filterOptions] = await Promise.all([
      getTerritoryProductSalesReport(filterInput, scope),
      getProductSalesFilterOptions(scope, {
        categoryId: filters.categoryId,
        productSearch: filters.productSearch || undefined,
      }),
    ]);
    report = toTerritoryProductSalesReportDTO(reportResult);
    options = filterOptions;
  } catch {
    errorKey = "productSales.error.generic";
    try {
      options = await getProductSalesFilterOptions(scope);
    } catch {
      // keep empty options
    }
  }

  const initialFilters: ProductSalesFiltersDTO = {
    from: formatLocalDateOnly(filters.from),
    to: formatLocalDateOnly(filters.to),
    territoryId: filters.territoryId,
    productId: filters.productId,
    categoryId: filters.categoryId,
    productSearch: filters.productSearch,
    view: filters.view,
    sort: filters.sort,
    page: report?.pagination.page ?? filters.page,
    pageSize: report?.pagination.pageSize ?? filters.pageSize,
    limit: filters.limit,
    mode: null,
  };

  return (
    <Suspense>
      <ProductSalesPageClient
        initialReport={report}
        filterOptions={options}
        initialFilters={initialFilters}
        initialErrorKey={errorKey}
      />
    </Suspense>
  );
}
