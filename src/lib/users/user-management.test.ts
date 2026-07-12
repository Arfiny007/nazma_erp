import { describe, expect, it } from "vitest";

import {
  assertLifecycleTransition,
  lifecycleToIsActive,
  resolveInitialLifecycleStatus,
} from "@/lib/users/user-lifecycle";
import { UserLifecycleError } from "@/lib/users/user-errors";
import {
  assertAssignableRole,
  assertCanManageTargetUser,
  assertTerritoryAssignmentScope,
  buildUserVisibilityWhere,
} from "@/lib/users/user-validation";
import { RoleEscalationError, UserScopeDeniedError } from "@/lib/users/user-errors";
import type { AuthUser } from "@/types/auth";

const superAdmin: AuthUser = {
  id: "admin-1",
  name: "Admin",
  email: "admin@test.local",
  role: "Super_Admin",
  isActive: true,
  mustChangePassword: false,
};

const manager: AuthUser = {
  id: "mgr-1",
  name: "Manager",
  email: "mgr@test.local",
  role: "Manager",
  isActive: true,
  mustChangePassword: false,
};

const sr: AuthUser = {
  id: "sr-1",
  name: "SR",
  email: "sr@test.local",
  role: "SR",
  isActive: true,
  mustChangePassword: false,
};

describe("user lifecycle", () => {
  it("resolves initial status for draft vs provisioned users", () => {
    expect(resolveInitialLifecycleStatus(true)).toBe("INVITED");
    expect(resolveInitialLifecycleStatus(false)).toBe("PENDING_ACTIVATION");
  });

  it("maps ACTIVE lifecycle to isActive true only", () => {
    expect(lifecycleToIsActive("ACTIVE")).toBe(true);
    expect(lifecycleToIsActive("DISABLED")).toBe(false);
    expect(lifecycleToIsActive("INVITED")).toBe(false);
  });

  it("allows super admin activation path", () => {
    expect(() => assertLifecycleTransition("INVITED", "ACTIVE")).not.toThrow();
    expect(() => assertLifecycleTransition("PENDING_ACTIVATION", "ACTIVE")).not.toThrow();
    expect(() => assertLifecycleTransition("ACTIVE", "DISABLED")).not.toThrow();
  });

  it("rejects invalid lifecycle transitions", () => {
    expect(() => assertLifecycleTransition("ARCHIVED", "ACTIVE")).toThrow(UserLifecycleError);
    expect(() => assertLifecycleTransition("ACTIVE", "INVITED")).toThrow(UserLifecycleError);
  });
});

describe("user RBAC validation", () => {
  it("allows super admin to assign any role", () => {
    expect(() => assertAssignableRole(superAdmin, "Manager")).not.toThrow();
    expect(() => assertAssignableRole(superAdmin, "SR")).not.toThrow();
  });

  it("blocks manager from assigning non-SR roles", () => {
    expect(() => assertAssignableRole(manager, "Manager")).toThrow(RoleEscalationError);
    expect(() => assertAssignableRole(manager, "Super_Admin")).toThrow(RoleEscalationError);
    expect(() => assertAssignableRole(manager, "SR")).not.toThrow();
  });

  it("blocks SR from assigning roles", () => {
    expect(() => assertAssignableRole(sr, "SR")).toThrow(RoleEscalationError);
  });

  it("restricts manager visibility to SR users in shared territories", () => {
    expect(() =>
      assertCanManageTargetUser(manager, "SR", ["t-1"], ["t-1"]),
    ).not.toThrow();

    expect(() =>
      assertCanManageTargetUser(manager, "SR", ["t-1"], ["t-2"]),
    ).toThrow(UserScopeDeniedError);

    expect(() =>
      assertCanManageTargetUser(manager, "Manager", ["t-1"], ["t-1"]),
    ).toThrow(UserScopeDeniedError);
  });

  it("enforces manager territory assignment scope", () => {
    expect(() =>
      assertTerritoryAssignmentScope(manager, ["t-1"], ["t-1", "t-2"]),
    ).not.toThrow();

    expect(() =>
      assertTerritoryAssignmentScope(manager, ["t-9"], ["t-1"]),
    ).toThrow(UserScopeDeniedError);
  });

  it("builds role-aware list visibility filters", () => {
    expect(buildUserVisibilityWhere(superAdmin, { mode: "ALL" })).toEqual({});
    expect(buildUserVisibilityWhere(manager, { mode: "TERRITORIES", territoryIds: ["t-1"] })).toEqual({
      role: "SR",
      territoryAssignments: {
        some: {
          isActive: true,
          territoryId: { in: ["t-1"] },
        },
      },
    });
    expect(buildUserVisibilityWhere(sr, { mode: "TERRITORIES", territoryIds: ["t-1"] })).toEqual({
      id: sr.id,
    });
  });
});

describe("financial regression guard", () => {
  it("user management module does not import posting-service", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    const userDir = path.join(process.cwd(), "src/lib/users");
    const files = await fs.readdir(userDir);

    for (const file of files) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
      const content = await fs.readFile(path.join(userDir, file), "utf8");
      expect(content).not.toContain("posting-service");
      expect(content).not.toContain("Dealer.currentBalance");
      expect(content).not.toContain("LedgerEntry");
    }
  });
});
