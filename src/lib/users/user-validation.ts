import type { Prisma } from "@prisma/client";
import type { UserRole } from "@prisma/client";

import type { AuthUser } from "@/types/auth";
import { hasPermission } from "@/lib/permissions";
import type { TerritoryScope } from "@/lib/rbac/territory";

import { RoleEscalationError, UserScopeDeniedError } from "./user-errors";

const MANAGER_CREATABLE_ROLES: readonly UserRole[] = ["SR"];
const MANAGER_MANAGEABLE_ROLES: readonly UserRole[] = ["SR"];

export function assertCanCreateUser(actor: AuthUser): void {
  if (!hasPermission(actor.role, "users:create")) {
    throw new UserScopeDeniedError("users:create required");
  }
}

export function assertCanUpdateUser(actor: AuthUser): void {
  if (!hasPermission(actor.role, "users:update")) {
    throw new UserScopeDeniedError("users:update required");
  }
}

export function assertCanActivateUser(actor: AuthUser): void {
  if (!hasPermission(actor.role, "users:activate")) {
    throw new UserScopeDeniedError("users:activate required");
  }
}

export function assertCanDisableUser(actor: AuthUser): void {
  if (!hasPermission(actor.role, "users:disable")) {
    throw new UserScopeDeniedError("users:disable required");
  }
}

export function assertCanViewUsers(actor: AuthUser): void {
  if (!hasPermission(actor.role, "users:view")) {
    throw new UserScopeDeniedError("users:view required");
  }
}

export function assertAssignableRole(actor: AuthUser, targetRole: UserRole): void {
  if (actor.role === "Super_Admin") {
    return;
  }

  if (actor.role === "Manager") {
    if (!MANAGER_CREATABLE_ROLES.includes(targetRole)) {
      throw new RoleEscalationError();
    }
    return;
  }

  throw new RoleEscalationError();
}

export function assertCanManageTargetUser(
  actor: AuthUser,
  targetRole: UserRole,
  actorTerritoryIds: readonly string[],
  targetTerritoryIds: readonly string[],
): void {
  if (actor.role === "Super_Admin" || actor.role === "Accounts") {
    return;
  }

  if (actor.role === "Manager") {
    if (!MANAGER_MANAGEABLE_ROLES.includes(targetRole)) {
      throw new UserScopeDeniedError("Manager may only manage SR users");
    }

    const overlap = targetTerritoryIds.some((id) => actorTerritoryIds.includes(id));
    if (!overlap && targetTerritoryIds.length > 0) {
      throw new UserScopeDeniedError("Target user is outside manager territory scope");
    }

    if (targetTerritoryIds.length === 0) {
      throw new UserScopeDeniedError("SR users must have territory assignments");
    }

    return;
  }

  throw new UserScopeDeniedError("Insufficient scope to manage user");
}

export function assertTerritoryAssignmentScope(
  actor: AuthUser,
  territoryIds: readonly string[],
  actorTerritoryIds: readonly string[],
): void {
  if (actor.role === "Super_Admin") {
    return;
  }

  if (actor.role === "Manager") {
    const invalid = territoryIds.filter((id) => !actorTerritoryIds.includes(id));
    if (invalid.length > 0) {
      throw new UserScopeDeniedError("Territory assignment outside manager scope");
    }
    return;
  }

  if (territoryIds.length > 0) {
    throw new UserScopeDeniedError("Territory assignment not permitted for this role");
  }
}

export function assertSelfAccessOnly(actor: AuthUser, targetUserId: string): void {
  if (actor.id === targetUserId) {
    return;
  }

  if (hasPermission(actor.role, "users:view")) {
    return;
  }

  throw new UserScopeDeniedError("SR may only view own profile");
}

export function buildUserVisibilityWhere(
  actor: AuthUser,
  scope: TerritoryScope,
): Prisma.UserWhereInput {
  if (actor.role === "Super_Admin" || actor.role === "Accounts") {
    return {};
  }

  if (actor.role === "Manager") {
    if (scope.mode === "NONE") {
      return { id: { in: [] } };
    }

    if (scope.mode === "ALL") {
      return { role: "SR" };
    }

    return {
      role: "SR",
      territoryAssignments: {
        some: {
          isActive: true,
          territoryId: { in: [...scope.territoryIds] },
        },
      },
    };
  }

  // SR — own profile only (handled at action layer)
  return { id: actor.id };
}

export function canActorResetPassword(actor: AuthUser): boolean {
  return actor.role === "Super_Admin" && hasPermission(actor.role, "users:update");
}
