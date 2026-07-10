import type { UserRole } from "@prisma/client";

import type { TerritoryScope } from "./territory-types";

/** Roles with unrestricted global territory visibility. */
export const GLOBAL_TERRITORY_ROLES: readonly UserRole[] = [
  "Super_Admin",
  "Accounts",
] as const;

/** Roles whose visibility is limited to assigned territories. */
export const SCOPED_TERRITORY_ROLES: readonly UserRole[] = [
  "Manager",
  "SR",
] as const;

/** Roles eligible for territory assignment (SR and Manager). */
export const ASSIGNABLE_TERRITORY_ROLES: readonly UserRole[] = [
  "Manager",
  "SR",
] as const;

export function isGlobalTerritoryRole(role: UserRole): boolean {
  return (GLOBAL_TERRITORY_ROLES as readonly string[]).includes(role);
}

export function isScopedTerritoryRole(role: UserRole): boolean {
  return (SCOPED_TERRITORY_ROLES as readonly string[]).includes(role);
}

export function isAssignableTerritoryRole(role: UserRole): boolean {
  return (ASSIGNABLE_TERRITORY_ROLES as readonly string[]).includes(role);
}

/**
 * Pure role → scope mode resolution. Database lookups happen in
 * `buildTerritoryScope()` for scoped roles.
 */
export function resolveTerritoryScopeMode(
  role: UserRole,
): TerritoryScope["mode"] {
  if (isGlobalTerritoryRole(role)) {
    return "ALL";
  }
  if (isScopedTerritoryRole(role)) {
    return "TERRITORIES";
  }
  return "NONE";
}

export function buildScopedTerritoryScope(
  territoryIds: readonly string[],
): TerritoryScope {
  if (territoryIds.length === 0) {
    return { mode: "NONE" };
  }
  return { mode: "TERRITORIES", territoryIds };
}

export function territoryIdMatchesScope(
  scope: TerritoryScope,
  territoryId: string | null | undefined,
): boolean {
  if (scope.mode === "ALL") {
    return true;
  }
  if (!territoryId) {
    return false;
  }
  if (scope.mode === "NONE") {
    return false;
  }
  return scope.territoryIds.includes(territoryId);
}
