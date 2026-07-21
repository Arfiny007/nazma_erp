import { quantityToFixed } from "./product-sales-calculations";
import type {
  ProductSalesAttributionDiagnostics,
  TerritoryProductSalesReport,
  TerritoryProductSalesRow,
  TerritoryProductSalesSummary,
  TerritorySubtotal,
  TopSellingProductPoint,
  TopSellingProductsChart,
  TerritoryProductChartSeries,
} from "./product-sales-types";
import type {
  ProductSalesAttributionDiagnosticsDTO,
  TerritoryProductSalesReportDTO,
  TerritoryProductSalesRowDTO,
  TerritoryProductSalesSummaryDTO,
  TopSellingProductChartPointDTO,
  TopSellingProductsChartDTO,
  TerritoryProductChartSeriesDTO,
} from "@/types/product-sales-territory";

function toDiagnosticsDTO(
  diagnostics: ProductSalesAttributionDiagnostics,
): ProductSalesAttributionDiagnosticsDTO {
  return {
    missingHistoricalTerritoryCount:
      diagnostics.missingHistoricalTerritoryCount,
    ambiguousHistoricalOwnershipCount:
      diagnostics.ambiguousHistoricalOwnershipCount,
    currentTerritoryFallbackCount: diagnostics.currentTerritoryFallbackCount,
    excludedRecordCount: diagnostics.excludedRecordCount,
  };
}

function toRowDTO(row: TerritoryProductSalesRow): TerritoryProductSalesRowDTO {
  return {
    territoryId: row.territoryId,
    territoryName: row.territoryName,
    productId: row.productId,
    productCode: row.productCode,
    productName: row.productName,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    soldQuantity: quantityToFixed(row.soldQuantity),
    invoiceCount: row.invoiceCount,
    dealerCount: row.dealerCount,
    territoryRank: row.territoryRank,
    overallRank: row.overallRank,
  };
}

function toSummaryDTO(
  summary: TerritoryProductSalesSummary,
): TerritoryProductSalesSummaryDTO {
  return {
    totalQuantity: quantityToFixed(summary.totalQuantity),
    distinctProducts: summary.distinctProducts,
    distinctTerritories: summary.distinctTerritories,
    invoiceCount: summary.invoiceCount,
    dealerCount: summary.dealerCount,
  };
}

function toSubtotalDTO(row: TerritorySubtotal) {
  return {
    territoryId: row.territoryId,
    territoryName: row.territoryName,
    soldQuantity: quantityToFixed(row.soldQuantity),
  };
}

export function toTerritoryProductSalesReportDTO(
  report: TerritoryProductSalesReport,
): TerritoryProductSalesReportDTO {
  return {
    rows: report.rows.map(toRowDTO),
    summary: toSummaryDTO(report.summary),
    diagnostics: toDiagnosticsDTO(report.diagnostics),
    pagination: { ...report.pagination },
    territorySubtotals: report.territorySubtotals.map(toSubtotalDTO),
    generatedAt: report.generatedAt.toISOString(),
  };
}

function toChartPointDTO(
  point: TopSellingProductPoint,
): TopSellingProductChartPointDTO {
  return {
    productId: point.productId,
    productCode: point.productCode,
    productName: point.productName,
    soldQuantity: quantityToFixed(point.soldQuantity),
    territoryCount: point.territoryCount,
  };
}

function toSeriesDTO(
  series: TerritoryProductChartSeries,
): TerritoryProductChartSeriesDTO {
  return {
    territoryId: series.territoryId,
    territoryName: series.territoryName,
    points: series.points.map(toChartPointDTO),
  };
}

export function toTopSellingProductsChartDTO(
  chart: TopSellingProductsChart,
): TopSellingProductsChartDTO {
  return {
    points: chart.points.map(toChartPointDTO),
    series: chart.series.map(toSeriesDTO),
    diagnostics: toDiagnosticsDTO(chart.diagnostics),
    reportHref: chart.reportHref,
    generatedAt: chart.generatedAt.toISOString(),
  };
}
