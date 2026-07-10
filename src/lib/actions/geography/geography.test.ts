import { describe, expect, it } from "vitest";

import {
  DISTRICTS,
  DIVISIONS,
  buildDefaultTerritorySeeds,
} from "@/lib/geography";
import {
  toDistrictDTO,
  toDivisionDTO,
  toTerritoryDTO,
} from "./helpers";

describe("bangladesh-geography-data", () => {
  it("contains exactly 8 divisions", () => {
    expect(DIVISIONS).toHaveLength(8);
    const codes = DIVISIONS.map((d) => d.code);
    expect(new Set(codes).size).toBe(8);
  });

  it("contains exactly 64 districts", () => {
    expect(DISTRICTS).toHaveLength(64);
    const codes = DISTRICTS.map((d) => d.code);
    expect(new Set(codes).size).toBe(64);
  });

  it("maps every district to a valid division", () => {
    const divisionCodes = new Set(DIVISIONS.map((d) => d.code));
    for (const district of DISTRICTS) {
      expect(divisionCodes.has(district.divisionCode)).toBe(true);
    }
  });

  it("builds one default territory per district", () => {
    const templates = buildDefaultTerritorySeeds();
    expect(templates).toHaveLength(64);
    const codes = templates.map((t) => t.code);
    expect(new Set(codes).size).toBe(64);
  });
});

describe("geography DTO mappers", () => {
  const now = new Date("2026-07-11T00:00:00.000Z");

  it("maps division rows", () => {
    const dto = toDivisionDTO({
      id: "div-1",
      code: "dhaka",
      name: "Dhaka",
      nameBn: "ঢাকা",
      sortOrder: 3,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    expect(dto).toEqual({
      id: "div-1",
      code: "dhaka",
      name: "Dhaka",
      nameBn: "ঢাকা",
      sortOrder: 3,
      isActive: true,
    });
  });

  it("maps district rows with division context", () => {
    const dto = toDistrictDTO({
      id: "dist-1",
      code: "dhaka",
      name: "Dhaka",
      nameBn: "ঢাকা",
      divisionId: "div-1",
      sortOrder: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      division: { id: "div-1", code: "dhaka", name: "Dhaka" },
    });

    expect(dto.divisionCode).toBe("dhaka");
    expect(dto.divisionName).toBe("Dhaka");
  });

  it("maps territory rows with full hierarchy", () => {
    const dto = toTerritoryDTO({
      id: "ter-1",
      code: "dhaka-main",
      name: "Dhaka — Main",
      nameBn: "ঢাকা — মূল",
      districtId: "dist-1",
      sortOrder: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      district: {
        id: "dist-1",
        code: "dhaka",
        name: "Dhaka",
        nameBn: "ঢাকা",
        divisionId: "div-1",
        sortOrder: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        division: { id: "div-1", code: "dhaka", name: "Dhaka" },
      },
    });

    expect(dto.districtName).toBe("Dhaka");
    expect(dto.divisionName).toBe("Dhaka");
    expect(dto.nameBn).toBe("ঢাকা — মূল");
  });
});

describe("geography validators", () => {
  it("rejects invalid division id in listDistrictsByDivision", async () => {
    const { listDistrictsByDivisionSchema } = await import(
      "@/lib/validators/geography.schema"
    );

    const parsed = listDistrictsByDivisionSchema.safeParse({
      divisionId: "not-a-uuid",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts searchTerritories defaults", async () => {
    const { searchTerritoriesSchema } = await import(
      "@/lib/validators/geography.schema"
    );

    const parsed = searchTerritoriesSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.pageSize).toBe(20);
      expect(parsed.data.activeOnly).toBe(true);
    }
  });
});
