export interface TerritoryProductSalesDocumentLabels {
  title: string;
  documentTitle: string;
  readOnly: string;
  reportPeriod: string;
  from: string;
  to: string;
  territoryScope: string;
  allTerritories: string;
  generatedAt: string;
  preparedFor: string;
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
  summaryTitle: string;
  totalSoldQuantity: string;
  totalProducts: string;
  totalTerritories: string;
  totalInvoices: string;
  totalDealers: string;
  diagnosticsTitle: string;
  missingHistorical: string;
  ambiguousOwnership: string;
  fallbackAttribution: string;
  excludedRecords: string;
  empty: string;
  uncategorized: string;
}

export interface TerritoryProductSalesDocumentFormatters {
  formatQuantity: (value: string) => string;
  formatDate: (isoDate: string) => string;
  formatDateTime: (iso: string) => string;
  formatInteger: (value: number) => string;
}
