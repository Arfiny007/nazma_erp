/**
 * Domain types for Territory-wise Product Sales — PHASE_12B / ADR-061.
 * Quantities remain Prisma.Decimal until DTO mapping.
 */

import type { Prisma } from "@prisma/client";

export const PRODUCT_SALES_PAGE_SIZES = [10, 25, 50, 100] as const;
export type ProductSalesPageSize = (typeof PRODUCT_SALES_PAGE_SIZES)[number];

export const DEFAULT_PRODUCT_SALES_PAGE_SIZE: ProductSalesPageSize = 25;
export const DEFAULT_TOP_PRODUCTS_LIMIT = 10;

export type ProductSalesViewMode = "territory-product" | "product-territory";
export type ProductSalesPrintMode = "report";
export type ProductSalesSort =
  | "quantity-desc"
  | "quantity-asc"
  | "product-asc"
  | "territory-asc";

export type AttributionSource =
  | "history"
  | "fallback"
  | "ambiguous"
  | "excluded";

export interface ProductSalesUrlFilters {
  from: Date;
  to: Date;
  territoryId: string | null;
  productId: string | null;
  categoryId: string | null;
  productSearch: string;
  view: ProductSalesViewMode;
  sort: ProductSalesSort;
  page: number;
  pageSize: ProductSalesPageSize;
  limit: number;
  /** Print route only — null on screen report. */
  mode: ProductSalesPrintMode | null;
}

export interface ProductSalesFilterParams {
  from?: string | Date | null;
  to?: string | Date | null;
  territoryId?: string | null;
  productId?: string | null;
  categoryId?: string | null;
  productSearch?: string | null;
  view?: ProductSalesViewMode | null;
  sort?: ProductSalesSort | null;
  page?: number | null;
  pageSize?: number | null;
  limit?: number | null;
  mode?: ProductSalesPrintMode | null;
}

export interface TerritoryProductSalesPrintPayload {
  mode: ProductSalesPrintMode;
  generatedAt: Date;
  preparedForRole: string;
  filters: {
    from: Date;
    to: Date;
    territoryId: string | null;
    territoryName: string | null;
    productId: string | null;
    categoryId: string | null;
    productSearch: string;
    view: ProductSalesViewMode;
    sort: ProductSalesSort;
  };
  rows: TerritoryProductSalesRow[];
  summary: TerritoryProductSalesSummary;
  diagnostics: ProductSalesAttributionDiagnostics;
}

export interface ProductSalesAttributionDiagnostics {
  missingHistoricalTerritoryCount: number;
  ambiguousHistoricalOwnershipCount: number;
  currentTerritoryFallbackCount: number;
  excludedRecordCount: number;
}

export interface TerritoryProductSalesAggregateRow {
  territoryId: string;
  productId: string;
  productCode: string;
  productName: string;
  categoryId: string | null;
  categoryName: string | null;
  soldQuantity: Prisma.Decimal;
  invoiceCount: number;
  dealerCount: number;
}

export interface TerritoryProductSalesRow extends TerritoryProductSalesAggregateRow {
  territoryName: string;
  territoryRank: number;
  overallRank: number;
}

export interface TerritoryProductSalesSummary {
  totalQuantity: Prisma.Decimal;
  distinctProducts: number;
  distinctTerritories: number;
  invoiceCount: number;
  dealerCount: number;
}

export interface TerritorySubtotal {
  territoryId: string;
  territoryName: string;
  soldQuantity: Prisma.Decimal;
}

export interface TerritoryProductSalesReport {
  rows: TerritoryProductSalesRow[];
  summary: TerritoryProductSalesSummary;
  diagnostics: ProductSalesAttributionDiagnostics;
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  territorySubtotals: TerritorySubtotal[];
  generatedAt: Date;
}

export interface TopSellingProductPoint {
  productId: string;
  productCode: string;
  productName: string;
  soldQuantity: Prisma.Decimal;
  territoryCount: number;
}

export interface TerritoryProductChartSeries {
  territoryId: string;
  territoryName: string;
  points: TopSellingProductPoint[];
}

export interface TopSellingProductsChart {
  points: TopSellingProductPoint[];
  series: TerritoryProductChartSeries[];
  diagnostics: ProductSalesAttributionDiagnostics;
  reportHref: string;
  generatedAt: Date;
}

export interface ProductSalesServiceContext {
  scopeTerritoryIds: readonly string[] | "ALL";
}
