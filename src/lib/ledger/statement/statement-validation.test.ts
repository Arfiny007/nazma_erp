import { describe, expect, it } from "vitest";

import {
  DealerNotFoundError,
  InvalidDateRangeError,
  InvalidPaginationError,
} from "@/lib/ledger/statement/statement-errors";
import {
  assertDealerExists,
  assertValidDateRange,
  assertValidPagination,
} from "@/lib/ledger/statement/statement-validation";

describe("statement-validation", () => {
  it("assertDealerExists narrows a found dealer", () => {
    const dealer = { dealerCode: "DLR-001" };
    expect(assertDealerExists(dealer, "DLR-001")).toBe(dealer);
  });

  it("assertDealerExists throws DealerNotFoundError when missing", () => {
    expect(() => assertDealerExists(null, "MISSING")).toThrow(DealerNotFoundError);
  });

  it("assertValidDateRange accepts open-ended ranges", () => {
    expect(() =>
      assertValidDateRange(new Date("2026-01-01"), undefined),
    ).not.toThrow();
  });

  it("assertValidDateRange rejects inverted ranges", () => {
    expect(() =>
      assertValidDateRange(
        new Date("2026-03-01"),
        new Date("2026-01-01"),
      ),
    ).toThrow(InvalidDateRangeError);
  });

  it("assertValidPagination rejects non-positive page numbers", () => {
    expect(() => assertValidPagination(0, 50)).toThrow(InvalidPaginationError);
  });

  it("assertValidPagination rejects pageSize above the module maximum", () => {
    expect(() => assertValidPagination(1, 500)).toThrow(InvalidPaginationError);
  });
});
