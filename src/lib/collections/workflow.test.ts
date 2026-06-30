import { describe, expect, it } from "vitest";
import { CollectionStatus, InvoiceStatus, Prisma } from "@prisma/client";

import { computeApplicableAllocationAmount } from "@/lib/collections/allocation-engine";
import {
  assertCollectionCanBeAllocated,
  assertCollectionCanBeConfirmed,
  assertCollectionCanBeUpdated,
  assertCollectionIsDraft,
  CollectionWorkflowError,
  computeInvoiceOutstanding,
  resolveCollectionStatusAfterAllocation,
  resolveInvoiceStatusAfterAllocation,
} from "@/lib/collections/workflow";

describe("collection workflow guards", () => {
  it("allows draft edits", () => {
    expect(() => assertCollectionIsDraft(CollectionStatus.Draft)).not.toThrow();
  });

  it("blocks confirmed edits", () => {
    expect(() => assertCollectionCanBeUpdated(CollectionStatus.Confirmed)).toThrow(
      CollectionWorkflowError,
    );
  });

  it("allows idempotent confirm check on confirmed", () => {
    expect(() =>
      assertCollectionCanBeConfirmed(CollectionStatus.Confirmed),
    ).not.toThrow();
  });

  it("blocks allocation on draft", () => {
    expect(() => assertCollectionCanBeAllocated(CollectionStatus.Draft)).toThrow(
      CollectionWorkflowError,
    );
  });

  it("allows allocation on partially allocated", () => {
    expect(() =>
      assertCollectionCanBeAllocated(CollectionStatus.PartiallyAllocated),
    ).not.toThrow();
  });
});

describe("collection allocation math", () => {
  it("caps allocation at pool and outstanding", () => {
    const result = computeApplicableAllocationAmount(
      new Prisma.Decimal("50000.00"),
      new Prisma.Decimal("30000.00"),
      new Prisma.Decimal("100000.00"),
    );
    expect(result.toFixed(2)).toBe("30000.00");
  });

  it("computes invoice outstanding from grand total", () => {
    const outstanding = computeInvoiceOutstanding(
      new Prisma.Decimal("100000.00"),
      new Prisma.Decimal("50000.00"),
    );
    expect(outstanding.toFixed(2)).toBe("50000.00");
  });

  it("computes full outstanding when no payments received", () => {
    const outstanding = computeInvoiceOutstanding(
      new Prisma.Decimal("100000.00"),
      new Prisma.Decimal("0.00"),
    );
    expect(outstanding.toFixed(2)).toBe("100000.00");
  });

  it("resolves allocated status when pool empty", () => {
    expect(
      resolveCollectionStatusAfterAllocation(new Prisma.Decimal(0)),
    ).toBe(CollectionStatus.Allocated);
  });

  it("resolves partial invoice status", () => {
    expect(
      resolveInvoiceStatusAfterAllocation(
        new Prisma.Decimal("100000.00"),
        new Prisma.Decimal("40000.00"),
      ),
    ).toBe(InvoiceStatus.Partial);
  });

  it("resolves paid invoice status", () => {
    expect(
      resolveInvoiceStatusAfterAllocation(
        new Prisma.Decimal("100000.00"),
        new Prisma.Decimal("100000.00"),
      ),
    ).toBe(InvoiceStatus.Paid);
  });
});
