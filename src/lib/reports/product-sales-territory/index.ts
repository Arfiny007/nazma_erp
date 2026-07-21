/**
 * Territory-wise Product Sales Report — PHASE_12B / ADR-061.
 *
 * Read-only reporting over InvoiceItem quantities with historical territory
 * attribution. Does not mutate financial or ownership state.
 */

export {
  ZERO,
  assignDenseRanksByQuantity,
  compareQuantityDescThenName,
  normalizeQuantity,
  quantityToFixed,
} from "./product-sales-calculations";

export {
  EmptyTerritoryScopeError,
  ProductSalesError,
  TerritoryOutOfScopeError,
} from "./product-sales-errors";
export type { ProductSalesErrorCode } from "./product-sales-errors";

export {
  toTerritoryProductSalesPrintPayloadDTO,
  toTerritoryProductSalesReportDTO,
  toTopSellingProductsChartDTO,
} from "./product-sales-mapper";

export {
  ELIGIBLE_INVOICE_STATUSES,
  aggregateTerritoryProductSales,
  buildEligibleInvoiceItemFilters,
  countDistinctInvoicesAndDealers,
  emptyAttributionDiagnostics,
  findCategoryOptions,
  findProductOptions,
  findTerritoryOptionsForScope,
  resolveAllowedTerritoryIds,
  resolveHistoricalTerritoryId,
  sqlText,
  sumSoldQuantity,
} from "./product-sales-query";
export type {
  EligibleInvoiceItemFilterOptions,
  ProductSalesReadClient,
} from "./product-sales-query";

export {
  getAllowedTerritoryOptions,
  getProductSalesFilterOptions,
  getTerritoryProductSalesPrintPayload,
  getTerritoryProductSalesReport,
  getTopSellingProductsByTerritory,
} from "./product-sales-service";

export {
  assertScopedReportAccess,
  assertTerritoryInScope,
  assertValidDateRange,
  assertValidPagination,
  assertValidPrintMode,
  buildProductSalesQuery,
  defaultReportDateRange,
  defaultUrlFilters,
  formatLocalDateOnly,
  mergeProductSalesFilters,
  normalizeFilters,
  parseLocalDateOnly,
  parseTerritoryProductSalesFilters,
  startOfDayAfter,
  toExclusiveDateBounds,
} from "./product-sales-validation";

export type {
  AttributionSource,
  ProductSalesAttributionDiagnostics,
  ProductSalesFilterParams,
  ProductSalesPageSize,
  ProductSalesPrintMode,
  ProductSalesServiceContext,
  ProductSalesSort,
  ProductSalesUrlFilters,
  ProductSalesViewMode,
  TerritoryProductChartSeries,
  TerritoryProductSalesAggregateRow,
  TerritoryProductSalesPrintPayload,
  TerritoryProductSalesReport,
  TerritoryProductSalesRow,
  TerritoryProductSalesSummary,
  TerritorySubtotal,
  TopSellingProductPoint,
  TopSellingProductsChart,
} from "./product-sales-types";
export {
  DEFAULT_PRODUCT_SALES_PAGE_SIZE,
  DEFAULT_TOP_PRODUCTS_LIMIT,
  PRODUCT_SALES_PAGE_SIZES,
} from "./product-sales-types";
