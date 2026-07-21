import type { TerritoryProductSalesDocumentLabels } from "./product-sales-document-types";

type Translate = (key: string) => string;

export function buildTerritoryProductSalesDocumentLabels(
  t: Translate,
): TerritoryProductSalesDocumentLabels {
  return {
    title: t("productSales.print.title"),
    documentTitle: t("productSales.print.documentTitle"),
    readOnly: t("productSales.readOnly"),
    reportPeriod: t("productSales.print.reportPeriod"),
    from: t("productSales.print.from"),
    to: t("productSales.print.to"),
    territoryScope: t("productSales.print.territoryScope"),
    allTerritories: t("productSales.meta.allTerritories"),
    generatedAt: t("productSales.print.generatedAt"),
    preparedFor: t("productSales.print.preparedFor"),
    sl: t("productSales.columns.sl"),
    territory: t("productSales.columns.territory"),
    productCode: t("productSales.columns.productCode"),
    productName: t("productSales.columns.productName"),
    category: t("productSales.columns.category"),
    soldQuantity: t("productSales.columns.soldQuantity"),
    invoiceCount: t("productSales.columns.invoiceCount"),
    dealerCount: t("productSales.columns.dealerCount"),
    territoryRank: t("productSales.columns.territoryRank"),
    overallRank: t("productSales.columns.overallRank"),
    summaryTitle: t("productSales.print.summaryTitle"),
    totalSoldQuantity: t("productSales.summary.totalQuantity"),
    totalProducts: t("productSales.summary.productsSold"),
    totalTerritories: t("productSales.summary.territoriesCovered"),
    totalInvoices: t("productSales.summary.invoices"),
    totalDealers: t("productSales.summary.dealers"),
    diagnosticsTitle: t("productSales.print.diagnosticsTitle"),
    missingHistorical: t("productSales.print.diagnostics.missingHistorical"),
    ambiguousOwnership: t("productSales.print.diagnostics.ambiguousOwnership"),
    fallbackAttribution: t("productSales.print.diagnostics.fallbackAttribution"),
    excludedRecords: t("productSales.print.diagnostics.excludedRecords"),
    empty: t("productSales.empty"),
    uncategorized: t("productSales.print.uncategorized"),
  };
}
