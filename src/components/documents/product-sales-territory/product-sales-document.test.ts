import { describe, expect, it } from "vitest";

import { mapTerritoryProductSalesToDocument } from "./product-sales-document-mapper";
import type { TerritoryProductSalesDocumentLabels } from "./product-sales-document-types";
import type { TerritoryProductSalesPrintPayloadDTO } from "@/types/product-sales-territory";

const labels: TerritoryProductSalesDocumentLabels = {
  title: "Territory Product Sales",
  documentTitle: "Territory-wise Product Sales Report",
  readOnly: "Read-only",
  reportPeriod: "Report Period",
  from: "From",
  to: "To",
  territoryScope: "Territory Scope",
  allTerritories: "All allowed territories",
  generatedAt: "Generated",
  preparedFor: "Prepared For",
  sl: "SL",
  territory: "Territory",
  productCode: "Product Code",
  productName: "Product Name",
  category: "Category",
  soldQuantity: "Sold Quantity",
  invoiceCount: "Invoices",
  dealerCount: "Dealers",
  territoryRank: "Territory Rank",
  overallRank: "Overall Rank",
  summaryTitle: "Summary",
  totalSoldQuantity: "Total Sold Quantity",
  totalProducts: "Products Sold",
  totalTerritories: "Territories Covered",
  totalInvoices: "Invoices",
  totalDealers: "Dealers",
  diagnosticsTitle: "Attribution Diagnostics",
  missingHistorical: "Missing historical territory",
  ambiguousOwnership: "Ambiguous ownership",
  fallbackAttribution: "Fallback attribution",
  excludedRecords: "Excluded records",
  empty: "No rows",
  uncategorized: "Uncategorized",
};

const payload: TerritoryProductSalesPrintPayloadDTO = {
  mode: "report",
  generatedAt: "2026-07-21T10:00:00.000Z",
  preparedForRole: "Manager",
  filters: {
    from: "2026-07-01",
    to: "2026-07-21",
    territoryId: "11111111-1111-4111-8111-111111111111",
    territoryName: "Dhaka North",
    productId: null,
    categoryId: null,
    productSearch: "",
    view: "territory-product",
    sort: "quantity-desc",
  },
  rows: [
    {
      territoryId: "11111111-1111-4111-8111-111111111111",
      territoryName: "Dhaka North",
      productId: "22222222-2222-4222-8222-222222222222",
      productCode: "NT-001",
      productName: "Brass Tap",
      categoryId: "33333333-3333-4333-8333-333333333333",
      categoryName: "Taps",
      soldQuantity: "1250.50",
      invoiceCount: 4,
      dealerCount: 2,
      territoryRank: 1,
      overallRank: 1,
    },
  ],
  summary: {
    totalQuantity: "1250.50",
    distinctProducts: 1,
    distinctTerritories: 1,
    invoiceCount: 4,
    dealerCount: 2,
  },
  diagnostics: {
    missingHistoricalTerritoryCount: 1,
    ambiguousHistoricalOwnershipCount: 0,
    currentTerritoryFallbackCount: 2,
    excludedRecordCount: 0,
  },
};

describe("territory product sales document mapper", () => {
  it("passes quantity strings through formatters without arithmetic", () => {
    const seen: string[] = [];
    const mapped = mapTerritoryProductSalesToDocument(payload, labels, {
      formatQuantity: (value) => {
        seen.push(value);
        return `Q(${value})`;
      },
      formatInteger: (value) => String(value),
      formatDate: (iso) => iso,
      formatDateTime: (iso) => iso,
    });

    expect(mapped.rows[0]?.soldQuantity).toBe("Q(1250.50)");
    expect(mapped.summary.totalSoldQuantity).toBe("Q(1250.50)");
    expect(seen).toEqual(["1250.50", "1250.50"]);
  });

  it("uses server summary totals and print metadata", () => {
    const mapped = mapTerritoryProductSalesToDocument(payload, labels, {
      formatQuantity: (value) => value,
      formatInteger: (value) => String(value),
      formatDate: (iso) => iso,
      formatDateTime: (iso) => iso,
    });

    expect(mapped.title).toBe("Territory-wise Product Sales Report");
    expect(mapped.territoryScopeLabel).toBe("Dhaka North");
    expect(mapped.preparedForLabel).toBe("Manager");
    expect(mapped.summary.totalProducts).toBe("1");
    expect(mapped.summary.totalInvoices).toBe("4");
    expect(mapped.rows).toHaveLength(1);
    expect(mapped.rows[0]?.productCode).toBe("NT-001");
  });

  it("prints only real attribution diagnostics with non-zero counts", () => {
    const mapped = mapTerritoryProductSalesToDocument(payload, labels, {
      formatQuantity: (value) => value,
      formatInteger: (value) => String(value),
      formatDate: (iso) => iso,
      formatDateTime: (iso) => iso,
    });

    expect(mapped.diagnostics.map((d) => d.label)).toEqual([
      "Missing historical territory",
      "Fallback attribution",
    ]);
    expect(mapped.diagnostics.map((d) => d.value)).toEqual(["1", "2"]);
  });

  it("falls back to all territories label when no territory selected", () => {
    const mapped = mapTerritoryProductSalesToDocument(
      {
        ...payload,
        filters: {
          ...payload.filters,
          territoryId: null,
          territoryName: null,
        },
      },
      labels,
      {
        formatQuantity: (value) => value,
        formatInteger: (value) => String(value),
        formatDate: (iso) => iso,
        formatDateTime: (iso) => iso,
      },
    );
    expect(mapped.territoryScopeLabel).toBe("All allowed territories");
  });
});
