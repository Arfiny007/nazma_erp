import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  classifyTerritoryRisk,
  EmptyMapScopeError,
  getAccountsTerritoryMap,
  getAdminTerritoryMap,
  getManagerTerritoryMap,
  getSrTerritoryMap,
  isValidTerritoryMapNode,
  parseMapFilters,
  resolveTerritoryMapForRole,
  sortNodesByMetric,
} from "@/lib/dashboard/maps";
import { buildTerritoryMapNode } from "@/lib/dashboard/maps/map-mappers";

/**
 * Enterprise Territory Map tests — PHASE_09C.
 */

vi.mock("@/lib/rbac/territory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rbac/territory")>();
  return {
    ...actual,
    buildTerritoryScope: vi.fn(),
  };
});

vi.mock("@/lib/dashboard/analytics/analytics-query", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/dashboard/analytics/analytics-query")
    >();
  return {
    ...actual,
    aggregateTerritoryDue: vi.fn(),
  };
});

import { buildTerritoryScope } from "@/lib/rbac/territory";
import { aggregateTerritoryDue } from "@/lib/dashboard/analytics/analytics-query";

const ALL_SCOPE = { mode: "ALL" as const };
const TERRITORY_SCOPE = {
  mode: "TERRITORIES" as const,
  territoryIds: ["terr-1"],
};

const geoRow = {
  id: "terr-1",
  name: "Dhaka Central",
  district: {
    id: "dist-1",
    name: "Dhaka",
    divisionId: "div-1",
    division: { id: "div-1", name: "Dhaka Division" },
  },
};

function createMockClient() {
  return {
    territory: {
      findMany: vi.fn().mockResolvedValue([geoRow]),
    },
    invoice: {
      findMany: vi.fn().mockResolvedValue([
        {
          grandTotal: new Prisma.Decimal("5000.00"),
          dealer: { territoryId: "terr-1" },
        },
      ]),
    },
    collection: {
      findMany: vi.fn().mockResolvedValue([
        {
          receivedAmount: new Prisma.Decimal("3000.00"),
          dealer: { territoryId: "terr-1" },
        },
      ]),
    },
    dealer: {
      groupBy: vi.fn().mockResolvedValue([
        { territoryId: "terr-1", _count: { id: 5 } },
      ]),
    },
    userTerritoryAssignment: {
      findMany: vi.fn().mockResolvedValue([
        { territoryId: "terr-1" },
        { territoryId: "terr-1" },
      ]),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buildTerritoryScope).mockResolvedValue(ALL_SCOPE);
  vi.mocked(aggregateTerritoryDue).mockResolvedValue(
    new Map([
      [
        "terr-1",
        { name: "Dhaka Central", due: new Prisma.Decimal("4000.00") },
      ],
    ]),
  );
});

describe("risk classification", () => {
  it("classifies HIGH when due exceeds collections", () => {
    expect(classifyTerritoryRisk(5000, 3000, 2000)).toBe("HIGH");
  });

  it("classifies MEDIUM when due exceeds sales but not collections", () => {
    expect(classifyTerritoryRisk(3000, 4000, 2000)).toBe("MEDIUM");
  });

  it("classifies LOW otherwise", () => {
    expect(classifyTerritoryRisk(1000, 3000, 5000)).toBe("LOW");
  });
});

describe("map DTO validity", () => {
  it("validates a correct TerritoryMapNode", () => {
    const node = buildTerritoryMapNode(geoRow, {
      territoryId: "terr-1",
      sales: new Prisma.Decimal("5000"),
      collections: new Prisma.Decimal("3000"),
      due: new Prisma.Decimal("4000"),
      dealerCount: 5,
      srCount: 2,
    });
    expect(isValidTerritoryMapNode(node)).toBe(true);
    expect(node.riskLevel).toBe("HIGH");
  });
});

describe("filter correctness", () => {
  it("parses valid filters with defaults", () => {
    const filters = parseMapFilters({});
    expect(filters.metric).toBe("sales");
    expect(filters.period).toBe("month");
  });

  it("sorts nodes by selected metric descending", () => {
    const nodes = [
      {
        territoryId: "a",
        territoryName: "A",
        districtName: "D",
        divisionName: "Div",
        sales: 100,
        collections: 50,
        due: 20,
        dealerCount: 3,
        srCount: 1,
        riskLevel: "LOW" as const,
      },
      {
        territoryId: "b",
        territoryName: "B",
        districtName: "D",
        divisionName: "Div",
        sales: 500,
        collections: 50,
        due: 20,
        dealerCount: 1,
        srCount: 1,
        riskLevel: "LOW" as const,
      },
    ];
    const sorted = sortNodesByMetric(nodes, "sales");
    expect(sorted[0]?.territoryId).toBe("b");
  });
});

describe("territory RBAC — admin visibility", () => {
  it("returns map nodes for Super Admin with ALL scope", async () => {
    const client = createMockClient();
    const payload = await getAdminTerritoryMap(
      "admin-1",
      undefined,
      client as never,
    );

    expect(payload.role).toBe("Super_Admin");
    expect(payload.nodes).toHaveLength(1);
    expect(payload.nodes[0]?.sales).toBe(5000);
    expect(payload.nodes[0]?.dealerCount).toBe(5);
    expect(payload.nodes[0]?.srCount).toBe(2);
  });
});

describe("territory RBAC — manager isolation", () => {
  it("scopes territories to assigned set", async () => {
    vi.mocked(buildTerritoryScope).mockResolvedValue(TERRITORY_SCOPE);
    const client = createMockClient();

    await getManagerTerritoryMap("mgr-1", undefined, client as never);

    expect(client.territory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["terr-1"] },
        }),
      }),
    );
  });
});

describe("territory RBAC — SR isolation", () => {
  it("returns simplified scope for SR", async () => {
    vi.mocked(buildTerritoryScope).mockResolvedValue(TERRITORY_SCOPE);
    const client = createMockClient();

    const payload = await getSrTerritoryMap("sr-1", undefined, client as never);

    expect(payload.role).toBe("SR");
    expect(payload.nodes).toHaveLength(1);
  });
});

describe("territory RBAC — accounts visibility", () => {
  it("returns financial exposure nodes for Accounts", async () => {
    const client = createMockClient();
    const payload = await getAccountsTerritoryMap(
      "acc-1",
      undefined,
      client as never,
    );

    expect(payload.role).toBe("Accounts");
    expect(payload.nodes[0]?.due).toBe(4000);
    expect(payload.nodes[0]?.collections).toBe(3000);
  });
});

describe("empty states", () => {
  it("throws EmptyMapScopeError when scope is NONE", async () => {
    vi.mocked(buildTerritoryScope).mockResolvedValue({ mode: "NONE" });
    const client = createMockClient();

    await expect(
      getAdminTerritoryMap("admin-1", undefined, client as never),
    ).rejects.toThrow(EmptyMapScopeError);
  });

  it("returns empty nodes when no territories match filters", async () => {
    const client = createMockClient();
    client.territory.findMany.mockResolvedValue([]);

    const payload = await getAdminTerritoryMap(
      "admin-1",
      undefined,
      client as never,
    );
    expect(payload.nodes).toHaveLength(0);
  });
});

describe("resolveTerritoryMapForRole", () => {
  it("routes to correct role handler", async () => {
    const client = createMockClient();
    const payload = await resolveTerritoryMapForRole(
      "user-1",
      "Manager",
      undefined,
      client as never,
    );
    expect(payload.role).toBe("Manager");
  });
});

describe("SR assignment counts", () => {
  it("counts active SR assignments per territory via findMany", async () => {
    const client = createMockClient();
    await getAdminTerritoryMap("admin-1", undefined, client as never);

    expect(client.userTerritoryAssignment.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        territoryId: { in: ["terr-1"] },
        user: { role: "SR", isActive: true },
      },
      select: { territoryId: true },
    });
  });
});

describe("dashboard integration — map payload shape", () => {
  it("includes filter options and generatedAt", async () => {
    const client = createMockClient();
    const payload = await getAdminTerritoryMap(
      "admin-1",
      { metric: "due", period: "quarter" },
      client as never,
    );

    expect(payload.filters.metric).toBe("due");
    expect(payload.filters.period).toBe("quarter");
    expect(payload.divisions).toHaveLength(1);
    expect(payload.districts).toHaveLength(1);
    expect(payload.generatedAt).toBeTruthy();
  });
});
