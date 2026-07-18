import { describe, expect, it } from "vitest";

import {
  searchAssignableTerritoriesSchema,
  searchAssignableUsersSchema,
} from "./territory-validation";

describe("territory assignment search pageSize limits", () => {
  it("accepts pageSize 50 for users and territories", () => {
    expect(
      searchAssignableUsersSchema.safeParse({ page: 1, pageSize: 50 }).success,
    ).toBe(true);
    expect(
      searchAssignableTerritoriesSchema.safeParse({ page: 1, pageSize: 50 })
        .success,
    ).toBe(true);
  });

  it("rejects pageSize 100 (panel territories request)", () => {
    const result = searchAssignableTerritoriesSchema.safeParse({
      page: 1,
      pageSize: 100,
    });
    expect(result.success).toBe(false);
  });

  it("accepts pageSize 100 for users schema only if within max", () => {
    const result = searchAssignableUsersSchema.safeParse({
      page: 1,
      pageSize: 100,
    });
    expect(result.success).toBe(false);
  });
});
