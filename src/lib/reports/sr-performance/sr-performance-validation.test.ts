import { describe, expect, it } from "vitest";

import {
  buildSrPerformanceQuery,
  defaultUrlFilters,
  formatLocalDateOnly,
  mergeSrPerformanceFilters,
  parseLocalDateOnly,
  parseSrPerformanceFilters,
  toExclusiveDateBounds,
} from "./sr-performance-validation";
import { SrPerformanceError } from "./sr-performance-errors";

describe("sr-performance filter contract", () => {
  it("parses date-only strings as local calendar dates without UTC shift", () => {
    const parsed = parseLocalDateOnly("2026-07-01");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(6);
    expect(parsed.getDate()).toBe(1);
    expect(parsed.getHours()).toBe(0);
    expect(formatLocalDateOnly(parsed)).toBe("2026-07-01");
  });

  it("rejects invalid date-only strings", () => {
    expect(() => parseLocalDateOnly("2026-13-01")).toThrow(SrPerformanceError);
    expect(() => parseLocalDateOnly("not-a-date")).toThrow(SrPerformanceError);
  });

  it("parseSrPerformanceFilters preserves valid URL parameters", () => {
    const filters = parseSrPerformanceFilters({
      from: "2026-07-01",
      to: "2026-07-19",
      territoryId: "11111111-1111-4111-8111-111111111111",
      srId: "22222222-2222-4222-8222-222222222222",
      srSearch: "Rahim",
      partySearch: "Alpha",
      page: "2",
      pageSize: "50",
      mode: "individual",
    });

    expect(formatLocalDateOnly(filters.from)).toBe("2026-07-01");
    expect(formatLocalDateOnly(filters.to)).toBe("2026-07-19");
    expect(filters.territoryId).toBe("11111111-1111-4111-8111-111111111111");
    expect(filters.srId).toBe("22222222-2222-4222-8222-222222222222");
    expect(filters.srSearch).toBe("Rahim");
    expect(filters.partySearch).toBe("Alpha");
    expect(filters.page).toBe(2);
    expect(filters.pageSize).toBe(50);
    expect(filters.mode).toBe("individual");
  });

  it("merge helper preserves unspecified filters", () => {
    const current = parseSrPerformanceFilters({
      from: "2026-07-01",
      to: "2026-07-19",
      territoryId: "11111111-1111-4111-8111-111111111111",
      srSearch: "Rahim",
      partySearch: "Alpha",
    });
    const merged = mergeSrPerformanceFilters(current, {
      srId: "22222222-2222-4222-8222-222222222222",
      page: 1,
    });
    expect(merged.territoryId).toBe(current.territoryId);
    expect(merged.srSearch).toBe("Rahim");
    expect(merged.partySearch).toBe("Alpha");
    expect(merged.srId).toBe("22222222-2222-4222-8222-222222222222");
    expect(merged.page).toBe(1);
  });

  it("reset defaults produce canonical current-month filters", () => {
    const now = new Date(2026, 6, 19);
    const defaults = defaultUrlFilters(now);
    expect(formatLocalDateOnly(defaults.from)).toBe("2026-07-01");
    expect(formatLocalDateOnly(defaults.to)).toBe("2026-07-19");
    expect(defaults.territoryId).toBeNull();
    expect(defaults.srId).toBeNull();
    expect(defaults.srSearch).toBe("");
    expect(defaults.partySearch).toBe("");
    expect(defaults.page).toBe(1);
  });

  it("exclusive date bounds use startOfDay(from) and startOfDay(to+1)", () => {
    const from = parseLocalDateOnly("2026-07-01");
    const to = parseLocalDateOnly("2026-07-19");
    const bounds = toExclusiveDateBounds(from, to);
    expect(formatLocalDateOnly(bounds.fromInclusive)).toBe("2026-07-01");
    expect(formatLocalDateOnly(bounds.toExclusive)).toBe("2026-07-20");
  });

  it("build query includes mode only when requested", () => {
    const filters = parseSrPerformanceFilters({
      from: "2026-07-01",
      to: "2026-07-19",
      mode: "overview",
    });
    expect(buildSrPerformanceQuery(filters)).not.toContain("mode=");
    expect(
      buildSrPerformanceQuery(filters, { includeMode: true }),
    ).toContain("mode=overview");
  });
});
