import type { UserRole } from "@prisma/client";

import type { TerritoryScope } from "@/lib/rbac/territory";

import {
  EmptyTerritoryScopeError,
  UnsupportedDashboardRoleError,
} from "./dashboard-errors";
import type { DashboardContext, DashboardRole } from "./dashboard-types";

const DASHBOARD_ROLES: readonly DashboardRole[] = [
  "SR",
  "Manager",
  "Accounts",
  "Super_Admin",
];

/** Maps session role to dashboard role or throws. */
export function assertDashboardRole(role: UserRole): DashboardRole {
  if (!DASHBOARD_ROLES.includes(role as DashboardRole)) {
    throw new UnsupportedDashboardRoleError(role);
  }
  return role as DashboardRole;
}

/** Ensures scoped roles have territory visibility before querying. */
export function assertScopedDashboardAccess(scope: TerritoryScope): void {
  if (scope.mode === "NONE") {
    throw new EmptyTerritoryScopeError();
  }
  if (scope.mode === "TERRITORIES" && scope.territoryIds.length === 0) {
    throw new EmptyTerritoryScopeError();
  }
}

export function resolveScopeKey(role: DashboardRole): string {
  switch (role) {
    case "SR":
      return "dashboard.scope.ownTerritories";
    case "Manager":
      return "dashboard.scope.assignedTerritories";
    case "Accounts":
    case "Super_Admin":
      return "dashboard.scope.all";
    default:
      return "dashboard.scope.all";
  }
}

export function resolveTitleKey(role: DashboardRole): string {
  switch (role) {
    case "SR":
      return "dashboard.titles.sr";
    case "Manager":
      return "dashboard.titles.manager";
    case "Accounts":
      return "dashboard.titles.accounts";
    case "Super_Admin":
      return "dashboard.titles.admin";
    default:
      return "dashboard.title";
  }
}

export function buildDashboardContext(
  userId: string,
  role: UserRole,
): DashboardContext {
  return {
    userId,
    role: assertDashboardRole(role),
  };
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfPreviousMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

export function endOfPreviousMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59, 999);
}
