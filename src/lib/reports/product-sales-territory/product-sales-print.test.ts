import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  getTerritoryProductSalesPrintPayload,
  toTerritoryProductSalesPrintPayloadDTO,
  toTerritoryProductSalesReportDTO,
  type ProductSalesReadClient,
  type TerritoryProductSalesPrintPayload,
  type TerritoryProductSalesReport,
} from "@/lib/reports/product-sales-territory";
import { TerritoryOutOfScopeError } from "@/lib/reports/product-sales-territory/product-sales-errors";

const TERRITORY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TERRITORY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PRODUCT_1 = "11111111-1111-4111-8111-111111111111";

function unusedClient(): ProductSalesReadClient {
  return {
    $queryRaw: vi.fn(async () => {
      throw new Error("print RBAC tests must not query");
    }),
    territory: { findMany: vi.fn(async () => []) },
    category: { findMany: vi.fn(async () => []) },
    product: { findMany: vi.fn(async () => []) },
    dealer: { findMany: vi.fn(async () => []) },
  } as unknown as ProductSalesReadClient;
}

describe("territory product sales print payload", () => {
  it("print DTO totals and rows match report DTO for the same certified data", () => {
    const generatedAt = new Date("2026-07-21T10:00:00.000Z");
    const row = {
      territoryId: TERRITORY_A,
      territoryName: "Dhaka North",
      productId: PRODUCT_1,
      productCode: "NT-001",
      productName: "Brass Tap",
      categoryId: null,
      categoryName: null,
      soldQuantity: new Prisma.Decimal("10.00"),
      invoiceCount: 2,
      dealerCount: 1,
      territoryRank: 1,
      overallRank: 1,
    };
    const summary = {
      totalQuantity: new Prisma.Decimal("10.00"),
      distinctProducts: 1,
      distinctTerritories: 1,
      invoiceCount: 2,
      dealerCount: 1,
    };
    const diagnostics = {
      missingHistoricalTerritoryCount: 0,
      ambiguousHistoricalOwnershipCount: 0,
      currentTerritoryFallbackCount: 0,
      excludedRecordCount: 0,
    };

    const report: TerritoryProductSalesReport = {
      rows: [row],
      summary,
      diagnostics,
      pagination: { page: 1, pageSize: 25, totalRows: 1, totalPages: 1 },
      territorySubtotals: [
        {
          territoryId: TERRITORY_A,
          territoryName: "Dhaka North",
          soldQuantity: new Prisma.Decimal("10.00"),
        },
      ],
      generatedAt,
    };

    const print: TerritoryProductSalesPrintPayload = {
      mode: "report",
      generatedAt,
      preparedForRole: "Super_Admin",
      filters: {
        from: new Date(2026, 6, 1),
        to: new Date(2026, 6, 21),
        territoryId: null,
        territoryName: null,
        productId: null,
        categoryId: null,
        productSearch: "",
        view: "territory-product",
        sort: "quantity-desc",
      },
      rows: report.rows,
      summary: report.summary,
      diagnostics: report.diagnostics,
    };

    const reportDto = toTerritoryProductSalesReportDTO(report);
    const printDto = toTerritoryProductSalesPrintPayloadDTO(print);

    expect(printDto.mode).toBe("report");
    expect(printDto.summary).toEqual(reportDto.summary);
    expect(printDto.rows).toEqual(reportDto.rows);
    expect(printDto.diagnostics).toEqual(reportDto.diagnostics);
  });

  it("rejects foreign territory for Manager/SR print scope", async () => {
    await expect(
      getTerritoryProductSalesPrintPayload(
        {
          from: "2026-07-01",
          to: "2026-07-21",
          territoryId: TERRITORY_B,
          mode: "report",
        },
        { mode: "TERRITORIES", territoryIds: [TERRITORY_A] },
        "Manager",
        unusedClient(),
      ),
    ).rejects.toBeInstanceOf(TerritoryOutOfScopeError);
  });

  it("requires mode=report", async () => {
    await expect(
      getTerritoryProductSalesPrintPayload(
        {
          from: "2026-07-01",
          to: "2026-07-21",
        },
        { mode: "ALL" },
        "SR",
        unusedClient(),
      ),
    ).rejects.toThrow(/Print mode must be report/);
  });
});
