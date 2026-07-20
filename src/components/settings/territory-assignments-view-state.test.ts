import { describe, expect, it } from "vitest";

import { resolveAssignmentsForSelectedUser } from "./territory-assignments-view-state";

describe("territory assignments derived view state", () => {
  const rows = [
    { id: "a1", territoryName: "North" },
    { id: "a2", territoryName: "South" },
  ];

  it("renders empty list when no user is selected", () => {
    expect(resolveAssignmentsForSelectedUser("", rows)).toEqual([]);
  });

  it("passes through loaded assignments for the selected user", () => {
    expect(resolveAssignmentsForSelectedUser("user-1", rows)).toEqual(rows);
  });

  it("selection reset does not require mutating cached rows", () => {
    const cached = [...rows];
    const visible = resolveAssignmentsForSelectedUser("", cached);
    expect(visible).toEqual([]);
    expect(cached).toEqual(rows);
  });
});
