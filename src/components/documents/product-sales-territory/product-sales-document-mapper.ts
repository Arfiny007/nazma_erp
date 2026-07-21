import type { TerritoryProductSalesPrintPayloadDTO } from "@/types/product-sales-territory";

import type {
  TerritoryProductSalesDocumentFormatters,
  TerritoryProductSalesDocumentLabels,
} from "./product-sales-document-types";

/**
 * Presentation mapping only — no quantity arithmetic.
 * Totals and rows come from the certified report DTO.
 */

export interface TerritoryProductSalesMappedDocument {
  title: string;
  fromLabel: string;
  toLabel: string;
  territoryScopeLabel: string;
  generatedAtLabel: string;
  preparedForLabel: string;
  readOnlyLabel: string;
  rows: Array<{
    sl: string;
    territory: string;
    productCode: string;
    productName: string;
    category: string;
    soldQuantity: string;
    invoiceCount: string;
    dealerCount: string;
    territoryRank: string;
    overallRank: string;
  }>;
  summary: {
    totalSoldQuantity: string;
    totalProducts: string;
    totalTerritories: string;
    totalInvoices: string;
    totalDealers: string;
  };
  diagnostics: Array<{ label: string; value: string }>;
}

export function mapTerritoryProductSalesToDocument(
  payload: TerritoryProductSalesPrintPayloadDTO,
  labels: TerritoryProductSalesDocumentLabels,
  formatters: TerritoryProductSalesDocumentFormatters,
): TerritoryProductSalesMappedDocument {
  const territoryScope =
    payload.filters.territoryName ??
    (payload.filters.territoryId
      ? payload.filters.territoryId
      : labels.allTerritories);

  const diagnostics: Array<{ label: string; value: string }> = [];
  const d = payload.diagnostics;
  if (d.missingHistoricalTerritoryCount > 0) {
    diagnostics.push({
      label: labels.missingHistorical,
      value: formatters.formatInteger(d.missingHistoricalTerritoryCount),
    });
  }
  if (d.ambiguousHistoricalOwnershipCount > 0) {
    diagnostics.push({
      label: labels.ambiguousOwnership,
      value: formatters.formatInteger(d.ambiguousHistoricalOwnershipCount),
    });
  }
  if (d.currentTerritoryFallbackCount > 0) {
    diagnostics.push({
      label: labels.fallbackAttribution,
      value: formatters.formatInteger(d.currentTerritoryFallbackCount),
    });
  }
  if (d.excludedRecordCount > 0) {
    diagnostics.push({
      label: labels.excludedRecords,
      value: formatters.formatInteger(d.excludedRecordCount),
    });
  }

  return {
    title: labels.documentTitle,
    fromLabel: formatters.formatDate(payload.filters.from),
    toLabel: formatters.formatDate(payload.filters.to),
    territoryScopeLabel: territoryScope,
    generatedAtLabel: formatters.formatDateTime(payload.generatedAt),
    preparedForLabel: payload.preparedForRole,
    readOnlyLabel: labels.readOnly,
    rows: payload.rows.map((row, index) => ({
      sl: String(index + 1),
      territory: row.territoryName,
      productCode: row.productCode,
      productName: row.productName,
      category: row.categoryName ?? labels.uncategorized,
      soldQuantity: formatters.formatQuantity(row.soldQuantity),
      invoiceCount: formatters.formatInteger(row.invoiceCount),
      dealerCount: formatters.formatInteger(row.dealerCount),
      territoryRank: formatters.formatInteger(row.territoryRank),
      overallRank: formatters.formatInteger(row.overallRank),
    })),
    summary: {
      totalSoldQuantity: formatters.formatQuantity(payload.summary.totalQuantity),
      totalProducts: formatters.formatInteger(payload.summary.distinctProducts),
      totalTerritories: formatters.formatInteger(
        payload.summary.distinctTerritories,
      ),
      totalInvoices: formatters.formatInteger(payload.summary.invoiceCount),
      totalDealers: formatters.formatInteger(payload.summary.dealerCount),
    },
    diagnostics,
  };
}
