import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  assignDenseRanksByQuantity,
  compareQuantityDescThenName,
  normalizeQuantity,
  quantityToFixed,
  resolveHistoricalTerritoryId,
  ZERO,
} from "@/lib/reports/product-sales-territory";
import {
  assertTerritoryInScope,
  assertValidDateRange,
  defaultReportDateRange,
  formatLocalDateOnly,
  mergeProductSalesFilters,
  normalizeFilters,
  parseLocalDateOnly,
  parseTerritoryProductSalesFilters,
  toExclusiveDateBounds,
} from "@/lib/reports/product-sales-territory/product-sales-validation";
import { TerritoryOutOfScopeError } from "@/lib/reports/product-sales-territory/product-sales-errors";
import { mapTopProductsByQuantityChart } from "@/lib/dashboard/analytics/analytics-mappers";

describe("product-sales quantity helpers", () => {
  it("keeps Decimal precision for large quantities", () => {
    const qty = normalizeQuantity("9999999999999999.99");
    expect(quantityToFixed(qty)).toBe("9999999999999999.99");
    expect(qty.plus(ZERO).toFixed(2)).toBe("9999999999999999.99");
  });

  it("sums decimal quantities without JS number arithmetic", () => {
    const a = new Prisma.Decimal("1.25");
    const b = new Prisma.Decimal("2.75");
    expect(a.plus(b).toFixed(2)).toBe("4.00");
  });

  it("ranks with deterministic tie-breakers", () => {
    const rows = [
      {
        soldQuantity: new Prisma.Decimal("10"),
        productName: "B",
        productId: "p2",
      },
      {
        soldQuantity: new Prisma.Decimal("10"),
        productName: "A",
        productId: "p1",
      },
      {
        soldQuantity: new Prisma.Decimal("5"),
        productName: "C",
        productId: "p3",
      },
    ].sort(compareQuantityDescThenName);

    expect(rows.map((r) => r.productId)).toEqual(["p1", "p2", "p3"]);
    const ranks = assignDenseRanksByQuantity(rows);
    expect(ranks).toEqual([1, 2, 3]);
  });
});

describe("historical territory attribution", () => {
  const invoiceDate = new Date(2026, 5, 15);

  it("uses ownership interval covering the invoice date", () => {
    const result = resolveHistoricalTerritoryId({
      invoiceDate,
      ownershipRows: [
        {
          territoryId: "t-old",
          effectiveFrom: new Date(2026, 0, 1),
          effectiveTo: new Date(2026, 5, 10),
        },
        {
          territoryId: "t-new",
          effectiveFrom: new Date(2026, 5, 10),
          effectiveTo: null,
        },
      ],
      currentTerritoryId: "t-new",
    });
    expect(result).toEqual({ territoryId: "t-new", source: "history" });
  });

  it("attributes pre-transfer invoice to old territory", () => {
    const result = resolveHistoricalTerritoryId({
      invoiceDate: new Date(2026, 4, 1),
      ownershipRows: [
        {
          territoryId: "t-old",
          effectiveFrom: new Date(2026, 0, 1),
          effectiveTo: new Date(2026, 5, 10),
        },
        {
          territoryId: "t-new",
          effectiveFrom: new Date(2026, 5, 10),
          effectiveTo: null,
        },
      ],
      currentTerritoryId: "t-new",
    });
    expect(result).toEqual({ territoryId: "t-old", source: "history" });
  });

  it("falls back to current territory with diagnostic source", () => {
    const result = resolveHistoricalTerritoryId({
      invoiceDate,
      ownershipRows: [],
      currentTerritoryId: "t-current",
    });
    expect(result).toEqual({
      territoryId: "t-current",
      source: "fallback",
    });
  });

  it("flags ambiguous overlapping ownership intervals", () => {
    const result = resolveHistoricalTerritoryId({
      invoiceDate,
      ownershipRows: [
        {
          territoryId: "t-a",
          effectiveFrom: new Date(2026, 0, 1),
          effectiveTo: null,
        },
        {
          territoryId: "t-b",
          effectiveFrom: new Date(2026, 3, 1),
          effectiveTo: null,
        },
      ],
      currentTerritoryId: "t-a",
    });
    expect(result.source).toBe("ambiguous");
    expect(result.territoryId).toBe("t-b");
  });

  it("excludes when no history and no current territory", () => {
    const result = resolveHistoricalTerritoryId({
      invoiceDate,
      ownershipRows: [],
      currentTerritoryId: null,
    });
    expect(result).toEqual({ territoryId: null, source: "excluded" });
  });
});

describe("parseTerritoryProductSalesFilters", () => {
  it("defaults to current calendar month and territory-product view", () => {
    const filters = parseTerritoryProductSalesFilters({});
    const defaults = defaultReportDateRange();
    expect(formatLocalDateOnly(filters.from)).toBe(
      formatLocalDateOnly(defaults.from),
    );
    expect(filters.view).toBe("territory-product");
    expect(filters.sort).toBe("quantity-desc");
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(25);
    expect(filters.limit).toBe(10);
  });

  it("parses date-only values without UTC shift", () => {
    const filters = parseTerritoryProductSalesFilters({
      from: "2026-07-01",
      to: "2026-07-20",
      view: "product-territory",
      sort: "product-asc",
      page: "2",
      pageSize: "50",
    });
    expect(filters.from.getFullYear()).toBe(2026);
    expect(filters.from.getMonth()).toBe(6);
    expect(filters.from.getDate()).toBe(1);
    expect(filters.view).toBe("product-territory");
    expect(filters.sort).toBe("product-asc");
    expect(filters.page).toBe(2);
    expect(filters.pageSize).toBe(50);

    const bounds = toExclusiveDateBounds(filters.from, filters.to);
    expect(bounds.toExclusive.getDate()).toBe(21);
  });

  it("rejects invalid date ranges", () => {
    expect(() =>
      parseTerritoryProductSalesFilters({
        from: "2026-07-20",
        to: "2026-07-01",
      }),
    ).toThrow();
  });

  it("resets page when territory changes via merge", () => {
    const current = normalizeFilters({
      from: "2026-07-01",
      to: "2026-07-20",
      page: 3,
      pageSize: 25,
    });
    const merged = mergeProductSalesFilters(current, {
      territoryId: "11111111-1111-4111-8111-111111111111",
    });
    expect(merged.page).toBe(1);
  });

  it("rejects foreign territory via assertTerritoryInScope", () => {
    expect(() =>
      assertTerritoryInScope(
        { mode: "TERRITORIES", territoryIds: ["t-1"] },
        "t-foreign",
      ),
    ).toThrow(TerritoryOutOfScopeError);
  });

  it("accepts valid ascending date range", () => {
    expect(() =>
      assertValidDateRange(
        parseLocalDateOnly("2026-07-01"),
        parseLocalDateOnly("2026-07-31"),
      ),
    ).not.toThrow();
  });
});

describe("dashboard top-products chart mapper", () => {
  it("converts Decimal only at chart boundary and preserves valueLabel", () => {
    const chart = mapTopProductsByQuantityChart(
      [
        {
          productId: "p1",
          productCode: "SKU-1",
          productName: "Basin Mixer",
          soldQuantity: new Prisma.Decimal("12.50"),
          territoryCount: 2,
        },
      ],
      { href: "/reports/product-sales-by-territory?from=2026-07-01" },
    );

    expect(chart.id).toBe("topProductsByQuantity");
    expect(chart.orientation).toBe("horizontal");
    expect(chart.type).toBe("bar");
    expect(chart.data[0]?.value).toBe(12.5);
    expect(chart.data[0]?.valueLabel).toBe("12.50");
    expect(chart.data[0]?.meta?.productCode).toBe("SKU-1");
    expect(chart.href).toContain("/reports/product-sales-by-territory");
  });
});

describe("eligible invoice status contract", () => {
  it("includes Issued/Paid/Partial/Overdue and excludes Draft", async () => {
    const { ELIGIBLE_INVOICE_STATUSES } = await import(
      "@/lib/reports/product-sales-territory"
    );
    expect(ELIGIBLE_INVOICE_STATUSES).toEqual([
      "Issued",
      "Paid",
      "Partial",
      "Overdue",
    ]);
    expect(ELIGIBLE_INVOICE_STATUSES).not.toContain("Draft");
  });
});
