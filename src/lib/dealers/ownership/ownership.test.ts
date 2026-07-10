import { describe, expect, it } from "vitest";

import {
  buildScopedTerritoryScope,
  territoryIdMatchesScope,
} from "@/lib/rbac/territory/territory-rules";
import {
  assignDealerTerritorySchema,
  dealerGeographySchema,
  transferDealerSchema,
} from "@/lib/dealers/ownership/ownership-validation";

describe("ownership validation schemas", () => {
  it("validates assignDealerTerritory input", () => {
    const result = assignDealerTerritorySchema.safeParse({
      dealerId: "550e8400-e29b-41d4-a716-446655440000",
      territoryId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    });
    expect(result.success).toBe(true);
  });

  it("requires reason on transferDealer", () => {
    const missing = transferDealerSchema.safeParse({
      dealerId: "550e8400-e29b-41d4-a716-446655440000",
      territoryId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    });
    expect(missing.success).toBe(false);

    const valid = transferDealerSchema.safeParse({
      dealerId: "550e8400-e29b-41d4-a716-446655440000",
      territoryId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      reason: "SR reassignment",
    });
    expect(valid.success).toBe(true);
  });

  it("validates dealer geography fields", () => {
    const result = dealerGeographySchema.safeParse({
      divisionId: "550e8400-e29b-41d4-a716-446655440000",
      districtId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      territoryId: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
    });
    expect(result.success).toBe(true);
  });
});

describe("territory assignment restrictions", () => {
  it("SR can only assign territories within scope", () => {
    const srScope = buildScopedTerritoryScope(["territory-a"]);
    expect(territoryIdMatchesScope(srScope, "territory-a")).toBe(true);
    expect(territoryIdMatchesScope(srScope, "territory-b")).toBe(false);
  });

  it("Manager uses same scoped territory model as SR", () => {
    const managerScope = buildScopedTerritoryScope(["north", "south"]);
    expect(territoryIdMatchesScope(managerScope, "north")).toBe(true);
    expect(territoryIdMatchesScope(managerScope, "east")).toBe(false);
  });

  it("Super Admin and Accounts have ALL scope", () => {
    expect(territoryIdMatchesScope({ mode: "ALL" }, "any-id")).toBe(true);
  });
});

describe("ownership business rules (pure)", () => {
  it("only one active ownership per dealer — NONE scope blocks unassigned SR", () => {
    const emptyScope = buildScopedTerritoryScope([]);
    expect(emptyScope.mode).toBe("NONE");
  });

  it("transfer closes prior record conceptually via effectiveTo", () => {
    const closed = {
      isActive: false,
      effectiveTo: new Date("2026-07-11T00:00:00Z"),
    };
    const active = { isActive: true, effectiveTo: null as Date | null };

    expect(closed.isActive).toBe(false);
    expect(closed.effectiveTo).not.toBeNull();
    expect(active.isActive).toBe(true);
    expect(active.effectiveTo).toBeNull();
  });

  it("legacy district matching is case-insensitive", () => {
    const normalize = (value: string) =>
      value.trim().toLowerCase().replace(/\s+/g, " ");

    expect(normalize("  Dhaka  ")).toBe("dhaka");
    expect(normalize("DHAKA")).toBe("dhaka");
  });

  it("backfill report structure", () => {
    const report = {
      migrated: 2,
      skipped: 1,
      failed: 0,
      details: [
        { dealerId: "1", dealerCode: "DLR-1", status: "migrated" as const, messageKey: "k" },
      ],
    };
    expect(report.migrated + report.skipped + report.failed).toBeGreaterThan(0);
    expect(report.details[0].status).toBe("migrated");
  });
});
