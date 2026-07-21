import { describe, expect, it } from "vitest";

import {
  buildEligibleInvoiceItemFilters,
  sqlText,
} from "./product-sales-query";

const SAMPLE_PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const SAMPLE_CATEGORY_ID = "22222222-2222-4222-8222-222222222222";

describe("PHASE_12B.1 eligible_invoice_items filter aliases", () => {
  it("productId filter uses ii scope alias, never eii", () => {
    const sql = sqlText(
      buildEligibleInvoiceItemFilters({
        productId: SAMPLE_PRODUCT_ID,
        categoryId: null,
        productSearch: "",
      }),
    );

    expect(sql).toContain('ii."productId"');
    expect(sql).not.toContain('eii."productId"');
    expect(sql).not.toContain('ha."productId"');
  });

  it("categoryId filter uses p.\"categoryId\"", () => {
    const sql = sqlText(
      buildEligibleInvoiceItemFilters({
        productId: null,
        categoryId: SAMPLE_CATEGORY_ID,
        productSearch: "",
      }),
    );

    expect(sql).toContain('p."categoryId"');
    expect(sql).not.toContain('eii."categoryId"');
  });

  it("productSearch uses ii productName/productCode and c name", () => {
    const sql = sqlText(
      buildEligibleInvoiceItemFilters({
        productId: null,
        categoryId: null,
        productSearch: "brass",
      }),
    );

    expect(sql).toContain('ii."productName"');
    expect(sql).toContain('ii."productCode"');
    expect(sql).toContain('c."name"');
    expect(sql).not.toContain('eii."productName"');
    expect(sql).not.toContain('eii."productCode"');
  });

  it("combined filters never emit unavailable CTE alias eii", () => {
    const sql = sqlText(
      buildEligibleInvoiceItemFilters({
        productId: SAMPLE_PRODUCT_ID,
        categoryId: SAMPLE_CATEGORY_ID,
        productSearch: "tap",
      }),
    );

    expect(sql).toContain('ii."productId"');
    expect(sql).toContain('p."categoryId"');
    expect(sql).toContain('ii."productName"');
    expect(sql).toContain('ii."productCode"');
    expect(sql).not.toMatch(/\beii\./);
  });

  it("empty filters yield TRUE", () => {
    const sql = sqlText(
      buildEligibleInvoiceItemFilters({
        productId: null,
        categoryId: null,
        productSearch: "",
      }),
    );
    expect(sql).toBe("TRUE");
  });
});
