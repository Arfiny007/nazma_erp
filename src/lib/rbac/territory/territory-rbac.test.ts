import { describe, expect, it } from "vitest";

import {
  mergeCollectionTerritoryScope,
  mergeDealerTerritoryScope,
  mergeOrderTerritoryScope,
} from "@/lib/rbac/territory/territory-filters";
import {
  buildScopedTerritoryScope,
  isAssignableTerritoryRole,
  isGlobalTerritoryRole,
  isScopedTerritoryRole,
  resolveTerritoryScopeMode,
  territoryIdMatchesScope,
} from "@/lib/rbac/territory/territory-rules";
import type { TerritoryScope } from "@/lib/rbac/territory/territory-types";

describe("territory-rules", () => {
  it("grants ALL scope to Super_Admin and Accounts", () => {
    expect(resolveTerritoryScopeMode("Super_Admin")).toBe("ALL");
    expect(resolveTerritoryScopeMode("Accounts")).toBe("ALL");
    expect(isGlobalTerritoryRole("Super_Admin")).toBe(true);
    expect(isGlobalTerritoryRole("Accounts")).toBe(true);
  });

  it("scopes Manager and SR to TERRITORIES mode", () => {
    expect(resolveTerritoryScopeMode("Manager")).toBe("TERRITORIES");
    expect(resolveTerritoryScopeMode("SR")).toBe("TERRITORIES");
    expect(isScopedTerritoryRole("Manager")).toBe(true);
    expect(isScopedTerritoryRole("SR")).toBe(true);
  });

  it("allows only Manager and SR for assignment", () => {
    expect(isAssignableTerritoryRole("SR")).toBe(true);
    expect(isAssignableTerritoryRole("Manager")).toBe(true);
    expect(isAssignableTerritoryRole("Accounts")).toBe(false);
    expect(isAssignableTerritoryRole("Super_Admin")).toBe(false);
  });

  it("buildScopedTerritoryScope returns NONE when empty", () => {
    expect(buildScopedTerritoryScope([])).toEqual({ mode: "NONE" });
    expect(buildScopedTerritoryScope(["t-1", "t-2"])).toEqual({
      mode: "TERRITORIES",
      territoryIds: ["t-1", "t-2"],
    });
  });

  it("territoryIdMatchesScope enforces scoped access", () => {
    const scope: TerritoryScope = { mode: "TERRITORIES", territoryIds: ["t-1"] };

    expect(territoryIdMatchesScope({ mode: "ALL" }, "t-9")).toBe(true);
    expect(territoryIdMatchesScope({ mode: "NONE" }, "t-1")).toBe(false);
    expect(territoryIdMatchesScope(scope, "t-1")).toBe(true);
    expect(territoryIdMatchesScope(scope, "t-2")).toBe(false);
    expect(territoryIdMatchesScope(scope, null)).toBe(false);
  });
});

describe("territory-filters", () => {
  const baseDealerWhere = { isActive: true };

  it("mergeDealerTerritoryScope leaves ALL scope unchanged", () => {
    const merged = mergeDealerTerritoryScope(baseDealerWhere, { mode: "ALL" });
    expect(merged).toEqual(baseDealerWhere);
  });

  it("mergeDealerTerritoryScope restricts to assigned territories", () => {
    const merged = mergeDealerTerritoryScope(baseDealerWhere, {
      mode: "TERRITORIES",
      territoryIds: ["t-1", "t-2"],
    });

    expect(merged).toEqual({
      AND: [baseDealerWhere, { territoryId: { in: ["t-1", "t-2"] } }],
    });
  });

  it("mergeDealerTerritoryScope returns empty set for NONE", () => {
    const merged = mergeDealerTerritoryScope(baseDealerWhere, { mode: "NONE" });
    expect(merged).toEqual({
      AND: [baseDealerWhere, { territoryId: { in: [] } }],
    });
  });

  it("mergeOrderTerritoryScope filters via dealer relation", () => {
    const merged = mergeOrderTerritoryScope(
      { status: "Approved" },
      { mode: "TERRITORIES", territoryIds: ["t-3"] },
    );

    expect(merged).toEqual({
      AND: [
        { status: "Approved" },
        { dealer: { territoryId: { in: ["t-3"] } } },
      ],
    });
  });

  it("mergeCollectionTerritoryScope filters via dealer relation", () => {
    const merged = mergeCollectionTerritoryScope(
      { status: "Confirmed" },
      { mode: "TERRITORIES", territoryIds: ["t-4"] },
    );

    expect(merged).toEqual({
      AND: [
        { status: "Confirmed" },
        { dealer: { territoryId: { in: ["t-4"] } } },
      ],
    });
  });
});

describe("territory validation schemas", () => {
  it("validates assignTerritory input", async () => {
    const { assignTerritorySchema } = await import(
      "@/lib/rbac/territory/territory-validation"
    );

    const valid = assignTerritorySchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      territoryId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      isPrimary: true,
    });

    expect(valid.success).toBe(true);
  });

  it("rejects invalid assignTerritory input", async () => {
    const { assignTerritorySchema } = await import(
      "@/lib/rbac/territory/territory-validation"
    );

    const invalid = assignTerritorySchema.safeParse({
      userId: "bad",
      territoryId: "bad",
    });

    expect(invalid.success).toBe(false);
  });
});

describe("territory RBAC business scenarios (pure)", () => {
  it("SR cannot access foreign dealer territory", () => {
    const srScope: TerritoryScope = {
      mode: "TERRITORIES",
      territoryIds: ["dhaka-main"],
    };

    expect(territoryIdMatchesScope(srScope, "chattogram-main")).toBe(false);
    expect(territoryIdMatchesScope(srScope, "dhaka-main")).toBe(true);
  });

  it("Manager can access supervised territory dealers", () => {
    const managerScope: TerritoryScope = {
      mode: "TERRITORIES",
      territoryIds: ["dhaka-main", "gazipur-main"],
    };

    expect(territoryIdMatchesScope(managerScope, "gazipur-main")).toBe(true);
  });

  it("Accounts and Super_Admin have unrestricted scope", () => {
    expect(territoryIdMatchesScope({ mode: "ALL" }, "any-territory")).toBe(true);
  });

  it("revoked assignment yields NONE scope via empty territory list", () => {
    const revokedScope = buildScopedTerritoryScope([]);
    const merged = mergeDealerTerritoryScope({}, revokedScope);
    expect(merged).toEqual({ AND: [{}, { territoryId: { in: [] } }] });
  });

  it("multiple territory assignment merges into single IN filter", () => {
    const multiScope: TerritoryScope = {
      mode: "TERRITORIES",
      territoryIds: ["t-a", "t-b", "t-c"],
    };

    const merged = mergeDealerTerritoryScope({}, multiScope);
    expect(merged).toEqual({
      AND: [{}, { territoryId: { in: ["t-a", "t-b", "t-c"] } }],
    });
  });
});
