import { describe, expect, it } from "vitest";
import { FinancialReferenceType, LedgerPostingType } from "@prisma/client";

import {
  buildLedgerPostingKey,
  isLedgerPostingKey,
  parseLedgerPostingKey,
} from "@/lib/ledger/posting-key";

describe("buildLedgerPostingKey", () => {
  it("builds a canonical key for a single-line posting", () => {
    const key = buildLedgerPostingKey({
      referenceType: FinancialReferenceType.Invoice,
      referenceId: "inv-123",
      postingType: LedgerPostingType.Issue,
    });
    expect(key).toBe("ledger:Invoice:inv-123:Issue");
  });

  it("includes sequence suffix when provided", () => {
    const key = buildLedgerPostingKey({
      referenceType: FinancialReferenceType.JournalEntry,
      referenceId: "je-9",
      postingType: LedgerPostingType.JournalEntry,
      sequence: 2,
    });
    expect(key).toBe("ledger:JournalEntry:je-9:JournalEntry:2");
  });

  it("is deterministic across calls", () => {
    const descriptor = {
      referenceType: FinancialReferenceType.Collection,
      referenceId: "col-abc",
      postingType: LedgerPostingType.Collection,
    } as const;
    expect(buildLedgerPostingKey(descriptor)).toBe(
      buildLedgerPostingKey(descriptor),
    );
  });

  it("rejects negative sequences", () => {
    expect(() =>
      buildLedgerPostingKey({
        referenceType: FinancialReferenceType.Invoice,
        referenceId: "inv-1",
        postingType: LedgerPostingType.Issue,
        sequence: -1,
      }),
    ).toThrow(RangeError);
  });

  it("rejects referenceId containing the separator", () => {
    expect(() =>
      buildLedgerPostingKey({
        referenceType: FinancialReferenceType.Invoice,
        referenceId: "inv:123",
        postingType: LedgerPostingType.Issue,
      }),
    ).toThrow(/separator/);
  });

  it("rejects empty referenceId", () => {
    expect(() =>
      buildLedgerPostingKey({
        referenceType: FinancialReferenceType.Invoice,
        referenceId: "",
        postingType: LedgerPostingType.Issue,
      }),
    ).toThrow(RangeError);
  });
});

describe("parseLedgerPostingKey", () => {
  it("round-trips build → parse", () => {
    const descriptor = {
      referenceType: FinancialReferenceType.Invoice,
      referenceId: "inv-round-trip",
      postingType: LedgerPostingType.Reversal,
    } as const;
    const parsed = parseLedgerPostingKey(buildLedgerPostingKey(descriptor));
    expect(parsed).toEqual(descriptor);
  });

  it("round-trips build → parse with sequence", () => {
    const descriptor = {
      referenceType: FinancialReferenceType.JournalEntry,
      referenceId: "je-multi",
      postingType: LedgerPostingType.JournalEntry,
      sequence: 5,
    } as const;
    const parsed = parseLedgerPostingKey(buildLedgerPostingKey(descriptor));
    expect(parsed).toEqual(descriptor);
  });

  it("rejects non-ledger keys", () => {
    expect(() => parseLedgerPostingKey("foo:Invoice:x:Issue")).toThrow();
  });

  it("rejects malformed keys", () => {
    expect(() => parseLedgerPostingKey("ledger:Invoice")).toThrow();
  });
});

describe("isLedgerPostingKey", () => {
  it("returns true for canonical keys", () => {
    expect(
      isLedgerPostingKey(
        buildLedgerPostingKey({
          referenceType: FinancialReferenceType.Invoice,
          referenceId: "inv-1",
          postingType: LedgerPostingType.Issue,
        }),
      ),
    ).toBe(true);
  });

  it("returns false for non-ledger keys", () => {
    expect(isLedgerPostingKey("other:namespace:x:y")).toBe(false);
    expect(isLedgerPostingKey("garbage")).toBe(false);
  });
});
