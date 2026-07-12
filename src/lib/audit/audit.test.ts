import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAuditSummary,
  classifyAuditAction,
  categoryMatchesRole,
  getAuditConsoleData,
  groupAuditTimeline,
  mapAuditLogRow,
  normalizeAuditFilters,
} from "@/lib/audit";
import type { AuditRecord } from "@/lib/audit";

vi.mock("@/lib/rbac/territory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rbac/territory")>();
  return {
    ...actual,
    buildTerritoryScope: vi.fn(),
    mergeDealerTerritoryScope: vi.fn((where) => where),
  };
});

import { buildTerritoryScope } from "@/lib/rbac/territory";

describe("audit validation", () => {
  it("classifies financial actions", () => {
    expect(classifyAuditAction("INVOICE_CREATED", "Invoice")).toBe("financial");
    expect(classifyAuditAction("DEALER_OPENING_BALANCE_POSTED", "Dealer")).toBe(
      "financial",
    );
  });

  it("restricts Accounts role to financial and integrity categories", () => {
    expect(categoryMatchesRole("Accounts", "INVOICE_CREATED", "Invoice")).toBe(true);
    expect(categoryMatchesRole("Accounts", "CREATE", "SalesOrder")).toBe(false);
    expect(
      categoryMatchesRole("Accounts", "FINANCIAL_INTEGRITY_SCAN", "System"),
    ).toBe(true);
  });

  it("allows Super Admin to view all categories", () => {
    expect(categoryMatchesRole("Super_Admin", "CREATE", "SalesOrder")).toBe(true);
    expect(categoryMatchesRole("Super_Admin", "LOGIN", "User")).toBe(true);
  });

  it("normalizes pagination bounds", () => {
    expect(normalizeAuditFilters({ page: 0, pageSize: 500 })).toEqual({
      page: 1,
      pageSize: 100,
    });
  });
});

describe("audit mappers", () => {
  it("maps audit rows into transport records", () => {
    const record = mapAuditLogRow({
      id: "log-1",
      userId: "user-1",
      entityType: "Invoice",
      entityId: "inv-1",
      action: "INVOICE_CREATED",
      oldValue: null,
      newValue: {
        invoiceNo: "INV-0001",
        dealerCode: "DLR-001",
      },
      createdAt: new Date("2026-07-13T10:00:00.000Z"),
      user: {
        id: "user-1",
        name: "Admin User",
        role: "Super_Admin",
      },
    });

    expect(record.userName).toBe("Admin User");
    expect(record.metadata.invoiceNo).toBe("INV-0001");
    expect(record.metadata.dealerCode).toBe("DLR-001");
  });

  it("builds summary counts by category", () => {
    const summary = buildAuditSummary([
      { action: "INVOICE_CREATED", entityType: "Invoice" },
      { action: "DEALER_BALANCE_UPDATED", entityType: "Dealer" },
      { action: "LOGIN", entityType: "User" },
      { action: "FINANCIAL_INTEGRITY_SCAN", entityType: "System" },
    ]);

    expect(summary.totalEvents).toBe(4);
    expect(summary.financialEvents).toBe(2);
    expect(summary.securityEvents).toBe(1);
    expect(summary.integrityEvents).toBe(1);
  });

  it("groups timeline records newest to oldest buckets", () => {
    const records: AuditRecord[] = [
      {
        id: "1",
        action: "INVOICE_CREATED",
        entityType: "Invoice",
        entityId: "a",
        userId: "u1",
        userName: "A",
        role: "Accounts",
        createdAt: new Date("2026-07-13T12:00:00.000Z").toISOString(),
        metadata: {},
      },
      {
        id: "2",
        action: "COLLECTION_CONFIRMED",
        entityType: "Collection",
        entityId: "b",
        userId: "u1",
        userName: "A",
        role: "Accounts",
        createdAt: new Date("2026-07-11T12:00:00.000Z").toISOString(),
        metadata: {},
      },
      {
        id: "3",
        action: "CREATE",
        entityType: "SalesOrder",
        entityId: "c",
        userId: "u1",
        userName: "A",
        role: "SR",
        createdAt: new Date("2026-06-01T12:00:00.000Z").toISOString(),
        metadata: {},
      },
    ];

    const groups = groupAuditTimeline(records);
    expect(groups[0]?.key).toBe("today");
    expect(groups.at(-1)?.key).toBe("older");
  });
});

describe("audit service RBAC", () => {
  beforeEach(() => {
    vi.mocked(buildTerritoryScope).mockReset();
  });

  it("enforces Manager territory scope through entity resolution", async () => {
    vi.mocked(buildTerritoryScope).mockResolvedValue({
      mode: "TERRITORIES",
      territoryIds: ["terr-1"],
    });

    const mockClient = {
      dealer: {
        findMany: vi.fn().mockResolvedValue([{ id: "d1", dealerCode: "DLR-001" }]),
      },
      invoice: {
        findMany: vi.fn().mockResolvedValue([{ id: "inv-1" }]),
      },
      collection: {
        findMany: vi.fn().mockResolvedValue([{ id: "col-1" }]),
      },
      salesOrder: {
        findMany: vi.fn().mockResolvedValue([{ id: "ord-1" }]),
      },
      deliveryChallan: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      dealerOwnershipHistory: {
        findMany: vi.fn(),
      },
      auditLog: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: "log-1",
              userId: "mgr-1",
              entityType: "Invoice",
              entityId: "inv-1",
              action: "INVOICE_CREATED",
              oldValue: null,
              newValue: { invoiceNo: "INV-1" },
              createdAt: new Date(),
              user: { id: "mgr-1", name: "Manager", role: "Manager" },
            },
          ])
          .mockResolvedValueOnce([
            { action: "INVOICE_CREATED", entityType: "Invoice" },
          ]),
      },
    };

    const result = await getAuditConsoleData(
      { userId: "mgr-1", role: "Manager" },
      { page: 1, pageSize: 25 },
      mockClient as never,
    );

    expect(result.records).toHaveLength(1);
    expect(mockClient.dealer.findMany).toHaveBeenCalled();
  });

  it("returns empty results for SR with no assigned dealers", async () => {
    vi.mocked(buildTerritoryScope).mockResolvedValue({
      mode: "TERRITORIES",
      territoryIds: ["terr-1"],
    });

    const mockClient = {
      dealer: {
        findMany: vi.fn().mockResolvedValue([{ id: "d1", dealerCode: "DLR-001" }]),
      },
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      collection: { findMany: vi.fn().mockResolvedValue([]) },
      salesOrder: { findMany: vi.fn().mockResolvedValue([]) },
      deliveryChallan: { findMany: vi.fn().mockResolvedValue([]) },
      dealerOwnershipHistory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      auditLog: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const result = await getAuditConsoleData(
      { userId: "sr-1", role: "SR" },
      { page: 1, pageSize: 25 },
      mockClient as never,
    );

    expect(result.records).toHaveLength(0);
    expect(result.summary.totalEvents).toBe(0);
  });
});

describe("audit pagination and search", () => {
  beforeEach(() => {
    vi.mocked(buildTerritoryScope).mockReset();
  });

  it("applies page and pageSize to queries", async () => {
    vi.mocked(buildTerritoryScope).mockResolvedValue({ mode: "ALL" });

    const findMany = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const mockClient = {
      dealer: { findMany: vi.fn() },
      invoice: { findMany: vi.fn() },
      collection: { findMany: vi.fn() },
      salesOrder: { findMany: vi.fn() },
      deliveryChallan: { findMany: vi.fn() },
      dealerOwnershipHistory: { findMany: vi.fn() },
      auditLog: {
        count: vi.fn().mockResolvedValue(120),
        findMany,
      },
    };

    const result = await getAuditConsoleData(
      { userId: "admin-1", role: "Super_Admin" },
      { page: 2, pageSize: 25, search: "INV-0001" },
      mockClient as never,
    );

    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(5);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 25,
        take: 25,
      }),
    );
  });
});

describe("audit immutability", () => {
  it("does not expose mutation methods on audit service exports", async () => {
    const auditModule = await import("./index");
    const exportNames = Object.keys(auditModule);
    expect(exportNames.some((name) => name.toLowerCase().includes("create"))).toBe(
      false,
    );
    expect(exportNames.some((name) => name.toLowerCase().includes("update"))).toBe(
      false,
    );
    expect(exportNames.some((name) => name.toLowerCase().includes("delete"))).toBe(
      false,
    );
  });
});
