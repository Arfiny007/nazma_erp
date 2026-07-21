/**
 * Transport-safe DTOs for Territory-wise Product Sales — PHASE_12B / ADR-061.
 * All quantity fields are Decimal(18,2) strings.
 */

export type ProductSalesErrorCode =
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "INVALID_DATE_RANGE"
  | "INVALID_PAGINATION"
  | "EMPTY_TERRITORY_SCOPE"
  | "TERRITORY_OUT_OF_SCOPE"
  | "INTERNAL_ERROR";

export interface FieldError {
  field: string;
  messageKey: string;
}

export interface ProductSalesActionError {
  code: ProductSalesErrorCode;
  messageKey: string;
  fieldErrors?: FieldError[];
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: ProductSalesActionError };

export type ProductSalesViewMode = "territory-product" | "product-territory";

export type ProductSalesSort =
  | "quantity-desc"
  | "quantity-asc"
  | "product-asc"
  | "territory-asc";

export interface ProductSalesAttributionDiagnosticsDTO {
  missingHistoricalTerritoryCount: number;
  ambiguousHistoricalOwnershipCount: number;
  currentTerritoryFallbackCount: number;
  excludedRecordCount: number;
}

export interface TerritoryProductSalesRowDTO {
  territoryId: string;
  territoryName: string;
  productId: string;
  productCode: string;
  productName: string;
  categoryId: string | null;
  categoryName: string | null;
  soldQuantity: string;
  invoiceCount: number;
  dealerCount: number;
  territoryRank: number;
  overallRank: number;
}

export interface TerritoryProductSalesSummaryDTO {
  totalQuantity: string;
  distinctProducts: number;
  distinctTerritories: number;
  invoiceCount: number;
  dealerCount: number;
}

export interface TerritoryProductSalesReportDTO {
  rows: TerritoryProductSalesRowDTO[];
  summary: TerritoryProductSalesSummaryDTO;
  diagnostics: ProductSalesAttributionDiagnosticsDTO;
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  territorySubtotals: Array<{
    territoryId: string;
    territoryName: string;
    soldQuantity: string;
  }>;
  generatedAt: string;
}

export interface TopSellingProductChartPointDTO {
  productId: string;
  productCode: string;
  productName: string;
  soldQuantity: string;
  territoryCount: number;
}

export interface TerritoryProductChartSeriesDTO {
  territoryId: string;
  territoryName: string;
  points: TopSellingProductChartPointDTO[];
}

export interface TopSellingProductsChartDTO {
  points: TopSellingProductChartPointDTO[];
  series: TerritoryProductChartSeriesDTO[];
  diagnostics: ProductSalesAttributionDiagnosticsDTO;
  reportHref: string;
  generatedAt: string;
}

export interface ProductSalesFilterOptionsDTO {
  territories: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  products: Array<{ id: string; code: string; name: string }>;
}

export interface ProductSalesFiltersDTO {
  from: string;
  to: string;
  territoryId: string | null;
  productId: string | null;
  categoryId: string | null;
  productSearch: string;
  view: ProductSalesViewMode;
  sort: ProductSalesSort;
  page: number;
  pageSize: number;
  limit: number;
}
