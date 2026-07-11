import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDealerCollectionContext } from "@/lib/actions/collections/get-dealer-collection-context";

/**
 * Collection context territory RBAC tests — PHASE_08E.1.
 */

const mockUser = { id: "user-sr-1", role: "SR" as const };

const mockDealer = {
  dealerCode: "D001",
  companyName: "Own Territory Dealer",
  creditLimit: new Prisma.Decimal("100000.00"),
  currentBalance: new Prisma.Decimal("5000.00"),
  monthlyTarget: new Prisma.Decimal(0),
  yearlyTarget: new Prisma.Decimal(0),
  totalSales: new Prisma.Decimal(0),
  lastCollectionDate: null,
  lastInvoiceDate: null,
};

vi.mock("@/lib/rbac/guards", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/rbac/territory", () => ({
  canAccessDealerByCode: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dealer: { findUnique: vi.fn() },
    invoice: { findMany: vi.fn() },
    collection: { aggregate: vi.fn() },
  },
}));

import { requirePermission } from "@/lib/rbac/guards";
import { canAccessDealerByCode } from "@/lib/rbac/territory";
import { prisma } from "@/lib/prisma";

const mockedRequirePermission = vi.mocked(requirePermission);
const mockedCanAccessDealerByCode = vi.mocked(canAccessDealerByCode);
const mockedDealerFindUnique = vi.mocked(prisma.dealer.findUnique);
const mockedInvoiceFindMany = vi.mocked(prisma.invoice.findMany);
const mockedCollectionAggregate = vi.mocked(prisma.collection.aggregate);

function stubSuccessfulDealerLoad(): void {
  mockedDealerFindUnique.mockResolvedValue(mockDealer as never);
  mockedInvoiceFindMany.mockResolvedValue([]);
  mockedCollectionAggregate.mockResolvedValue({
    _sum: { unallocatedAmount: null },
  } as never);
}

describe("getDealerCollectionContext — territory RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequirePermission.mockResolvedValue(mockUser as never);
  });

  it("SR can access own territory dealer collection context", async () => {
    mockedCanAccessDealerByCode.mockResolvedValue(true);
    stubSuccessfulDealerLoad();

    const result = await getDealerCollectionContext({ dealerCode: "D001" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dealer.dealerCode).toBe("D001");
    }
    expect(mockedCanAccessDealerByCode).toHaveBeenCalledWith("user-sr-1", "D001");
    expect(mockedDealerFindUnique).toHaveBeenCalled();
  });

  it("SR cannot access foreign dealer collection context", async () => {
    mockedCanAccessDealerByCode.mockResolvedValue(false);

    const result = await getDealerCollectionContext({ dealerCode: "D-FOREIGN" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.messageKey).toBe("rbac.territory.noAccess");
    }
    expect(mockedDealerFindUnique).not.toHaveBeenCalled();
    expect(mockedInvoiceFindMany).not.toHaveBeenCalled();
  });

  it("Manager can access dealer within assigned territory", async () => {
    mockedRequirePermission.mockResolvedValue({
      id: "user-mgr-1",
      role: "Manager",
    } as never);
    mockedCanAccessDealerByCode.mockResolvedValue(true);
    stubSuccessfulDealerLoad();

    const result = await getDealerCollectionContext({ dealerCode: "D001" });

    expect(result.success).toBe(true);
    expect(mockedCanAccessDealerByCode).toHaveBeenCalledWith("user-mgr-1", "D001");
  });

  it("Accounts has unrestricted collection context access", async () => {
    mockedRequirePermission.mockResolvedValue({
      id: "user-acct-1",
      role: "Accounts",
    } as never);
    mockedCanAccessDealerByCode.mockResolvedValue(true);
    stubSuccessfulDealerLoad();

    const result = await getDealerCollectionContext({ dealerCode: "D-ANY" });

    expect(result.success).toBe(true);
    expect(mockedCanAccessDealerByCode).toHaveBeenCalledWith("user-acct-1", "D-ANY");
  });

  it("Super Admin has unrestricted collection context access", async () => {
    mockedRequirePermission.mockResolvedValue({
      id: "user-admin-1",
      role: "Super_Admin",
    } as never);
    mockedCanAccessDealerByCode.mockResolvedValue(true);
    stubSuccessfulDealerLoad();

    const result = await getDealerCollectionContext({ dealerCode: "D-ANY" });

    expect(result.success).toBe(true);
    expect(mockedCanAccessDealerByCode).toHaveBeenCalledWith("user-admin-1", "D-ANY");
  });

  it("enforces territory gate before any financial data query", async () => {
    mockedCanAccessDealerByCode.mockResolvedValue(false);

    await getDealerCollectionContext({ dealerCode: "D001" });

    const gateOrder = mockedCanAccessDealerByCode.mock.invocationCallOrder[0];
    const dealerOrder = mockedDealerFindUnique.mock.invocationCallOrder[0];
    expect(gateOrder).toBeDefined();
    expect(dealerOrder).toBeUndefined();
  });

  it("collection workspace remains functional when access is granted", async () => {
    mockedCanAccessDealerByCode.mockResolvedValue(true);
    stubSuccessfulDealerLoad();
    mockedInvoiceFindMany.mockResolvedValue([
      {
        id: "inv-1",
        invoiceNo: "INV-001",
        issueDate: new Date("2026-06-01"),
        dueDate: new Date("2026-07-01"),
        grandTotal: new Prisma.Decimal("1000.00"),
        currentDue: new Prisma.Decimal("1000.00"),
        collectionReceived: new Prisma.Decimal(0),
        status: "Issued",
      },
    ] as never);

    const result = await getDealerCollectionContext({ dealerCode: "D001" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outstandingInvoices).toHaveLength(1);
      expect(result.data.outstandingInvoices[0]?.invoiceNo).toBe("INV-001");
    }
  });
});

describe("getDealerCollectionContext — source contract", () => {
  it("uses canAccessDealerByCode from territory RBAC engine", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/lib/actions/collections/get-dealer-collection-context.ts",
      ),
      "utf8",
    );

    expect(source).toContain("canAccessDealerByCode");
    expect(source).toContain("rbac.territory.noAccess");
    expect(source.indexOf("canAccessDealerByCode")).toBeLessThan(
      source.indexOf("prisma.dealer.findUnique"),
    );
  });
});

describe("territory reassignment and ownership — unaffected", () => {
  it("territory gate delegates to centralized canAccessDealerByCode", () => {
    expect(typeof canAccessDealerByCode).toBe("function");
  });

  it("ownership history module is separate from collection context reads", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/lib/actions/collections/get-dealer-collection-context.ts",
      ),
      "utf8",
    );

    expect(source).not.toContain("DealerOwnershipHistory");
    expect(source).not.toContain("ownership-service");
  });
});
