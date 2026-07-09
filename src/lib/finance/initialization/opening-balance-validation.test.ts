import { describe, expect, it } from "vitest";
import { OpeningBalanceStatus, Prisma } from "@prisma/client";

import { OpeningBalanceError } from "@/lib/finance/initialization/opening-balance-errors";
import {
  assertDealerExists,
  assertDealerNotInitialized,
  assertDraftForValidation,
  assertNotLocked,
  assertPreviousBalanceZero,
  assertRecordFound,
  assertValidatedForPosting,
  collectOpeningBalanceValidationIssues,
} from "@/lib/finance/initialization/opening-balance-validation";

/**
 * Unit tests for the PHASE_07C business rule guards. Each guard is a pure
 * function, so these run without any Prisma stub — only the failure/success
 * contract matters.
 */

describe("assertDealerExists", () => {
  it("returns the dealer when found", () => {
    const dealer = { dealerCode: "DLR-1" };
    expect(assertDealerExists(dealer)).toBe(dealer);
  });

  it("throws DEALER_NOT_FOUND when null", () => {
    expect(() => assertDealerExists(null)).toThrow(OpeningBalanceError);
    try {
      assertDealerExists(null);
    } catch (error) {
      expect((error as OpeningBalanceError).code).toBe("DEALER_NOT_FOUND");
    }
  });
});

describe("assertDealerNotInitialized — duplicate initialization guard", () => {
  it("passes silently when no existing record", () => {
    expect(() => assertDealerNotInitialized(null)).not.toThrow();
  });

  it("throws ALREADY_INITIALIZED when a record already exists for the dealer", () => {
    expect(() => assertDealerNotInitialized({ id: "ob-1" })).toThrow(
      OpeningBalanceError,
    );
    try {
      assertDealerNotInitialized({ id: "ob-1" });
    } catch (error) {
      expect((error as OpeningBalanceError).code).toBe("ALREADY_INITIALIZED");
    }
  });
});

describe("assertRecordFound", () => {
  it("throws RECORD_NOT_FOUND when null", () => {
    expect(() => assertRecordFound(null)).toThrow(OpeningBalanceError);
  });

  it("returns the record when present", () => {
    const record = { id: "ob-1" };
    expect(assertRecordFound(record)).toBe(record);
  });
});

describe("assertDraftForValidation", () => {
  it("allows Draft", () => {
    expect(() => assertDraftForValidation(OpeningBalanceStatus.Draft)).not.toThrow();
  });

  it.each([
    OpeningBalanceStatus.Validated,
    OpeningBalanceStatus.Posted,
    OpeningBalanceStatus.Locked,
  ])("rejects %s", (status) => {
    expect(() => assertDraftForValidation(status)).toThrow(OpeningBalanceError);
  });
});

describe("assertValidatedForPosting", () => {
  it("rejects Draft (validation must not be skipped)", () => {
    expect(() => assertValidatedForPosting(OpeningBalanceStatus.Draft)).toThrow(
      OpeningBalanceError,
    );
  });

  it.each([
    OpeningBalanceStatus.Validated,
    OpeningBalanceStatus.Posted,
    OpeningBalanceStatus.Locked,
  ])("allows %s", (status) => {
    expect(() => assertValidatedForPosting(status)).not.toThrow();
  });
});

describe("assertNotLocked — immutability guard", () => {
  it("throws IMMUTABLE_RECORD for Locked", () => {
    expect(() => assertNotLocked(OpeningBalanceStatus.Locked)).toThrow(
      OpeningBalanceError,
    );
    try {
      assertNotLocked(OpeningBalanceStatus.Locked);
    } catch (error) {
      expect((error as OpeningBalanceError).code).toBe("IMMUTABLE_RECORD");
    }
  });

  it.each([
    OpeningBalanceStatus.Draft,
    OpeningBalanceStatus.Validated,
    OpeningBalanceStatus.Posted,
  ])("allows %s", (status) => {
    expect(() => assertNotLocked(status)).not.toThrow();
  });
});

describe("assertPreviousBalanceZero", () => {
  it("allows exactly zero", () => {
    expect(() => assertPreviousBalanceZero(new Prisma.Decimal(0))).not.toThrow();
  });

  it.each(["0.01", "-0.01", "100.00", "-500.00"])(
    "rejects non-zero previousBalance %s",
    (value) => {
      expect(() =>
        assertPreviousBalanceZero(new Prisma.Decimal(value)),
      ).toThrow(OpeningBalanceError);
    },
  );
});

describe("collectOpeningBalanceValidationIssues", () => {
  const baseParams = {
    amount: new Prisma.Decimal("100.00"),
    effectiveDate: new Date("2026-01-01"),
    dealerExists: true,
  };

  it("returns no issues for a fully valid draft", () => {
    expect(collectOpeningBalanceValidationIssues(baseParams)).toEqual([]);
  });

  it("flags a missing dealer", () => {
    const issues = collectOpeningBalanceValidationIssues({
      ...baseParams,
      dealerExists: false,
    });
    expect(issues).toContainEqual({
      field: "dealerCode",
      messageKey: "openingBalance.error.dealerNotFound",
    });
  });

  it("flags amount precision beyond two decimal places", () => {
    const issues = collectOpeningBalanceValidationIssues({
      ...baseParams,
      amount: new Prisma.Decimal("100.123"),
    });
    expect(issues).toContainEqual({
      field: "amount",
      messageKey: "openingBalance.validation.amountPrecision",
    });
  });

  it("flags an invalid effective date", () => {
    const issues = collectOpeningBalanceValidationIssues({
      ...baseParams,
      effectiveDate: new Date(Number.NaN),
    });
    expect(issues).toContainEqual({
      field: "effectiveDate",
      messageKey: "openingBalance.validation.effectiveDateInvalid",
    });
  });

  it("flags a future effective date", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 5);
    const issues = collectOpeningBalanceValidationIssues({
      ...baseParams,
      effectiveDate: future,
    });
    expect(issues).toContainEqual({
      field: "effectiveDate",
      messageKey: "openingBalance.validation.effectiveDateFuture",
    });
  });

  it("accumulates multiple issues at once", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 5);
    const issues = collectOpeningBalanceValidationIssues({
      amount: new Prisma.Decimal("1.999"),
      effectiveDate: future,
      dealerExists: false,
    });
    expect(issues).toHaveLength(3);
  });

  it("allows negative amounts (advance) with no precision issue", () => {
    const issues = collectOpeningBalanceValidationIssues({
      ...baseParams,
      amount: new Prisma.Decimal("-250.00"),
    });
    expect(issues).toEqual([]);
  });

  it("allows zero amount with no precision issue", () => {
    const issues = collectOpeningBalanceValidationIssues({
      ...baseParams,
      amount: new Prisma.Decimal("0.00"),
    });
    expect(issues).toEqual([]);
  });
});
