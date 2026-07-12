import type { UserRole } from "@prisma/client";
import { z } from "zod";

import type { TerritoryScope } from "@/lib/rbac/territory";
import { startOfMonth } from "@/lib/dashboard/dashboard-validation";

import {
  EmptyMapScopeError,
  InvalidMapFiltersError,
  UnsupportedMapRoleError,
} from "./map-errors";
import type {
  MapContext,
  MapRole,
  TerritoryMapFilters,
  TerritoryMapNode,
  TerritoryRiskLevel,
} from "./map-types";
import { DEFAULT_MAP_FILTERS } from "./map-types";

const MAP_ROLES: readonly MapRole[] = [
  "SR",
  "Manager",
  "Accounts",
  "Super_Admin",
];

export const territoryMapFiltersSchema = z.object({
  divisionId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  metric: z.enum(["sales", "collections", "due", "dealerCount"]),
  period: z.enum(["month", "quarter", "year"]),
});

export function assertMapRole(role: UserRole): MapRole {
  if (!MAP_ROLES.includes(role as MapRole)) {
    throw new UnsupportedMapRoleError(role);
  }
  return role as MapRole;
}

export function assertMapScope(scope: TerritoryScope): void {
  if (scope.mode === "NONE") {
    throw new EmptyMapScopeError();
  }
  if (scope.mode === "TERRITORIES" && scope.territoryIds.length === 0) {
    throw new EmptyMapScopeError();
  }
}

export function buildMapContext(userId: string, role: UserRole): MapContext {
  return {
    userId,
    role: assertMapRole(role),
  };
}

export function parseMapFilters(
  input?: Partial<TerritoryMapFilters>,
): TerritoryMapFilters {
  const merged = { ...DEFAULT_MAP_FILTERS, ...input };
  const result = territoryMapFiltersSchema.safeParse(merged);
  if (!result.success) {
    throw new InvalidMapFiltersError("Invalid territory map filters");
  }
  return result.data;
}

/**
 * Visualization-only risk classification.
 * NOT persisted. NOT used in financial logic.
 */
export function classifyTerritoryRisk(
  due: number,
  collections: number,
  sales: number,
): TerritoryRiskLevel {
  if (due > collections) {
    return "HIGH";
  }
  if (due > sales) {
    return "MEDIUM";
  }
  return "LOW";
}

export function resolvePeriodRange(
  period: TerritoryMapFilters["period"],
  asOf: Date = new Date(),
): { from: Date; to: Date } {
  const to = asOf;
  switch (period) {
    case "month":
      return { from: startOfMonth(asOf), to };
    case "quarter": {
      const quarterMonth = Math.floor(asOf.getMonth() / 3) * 3;
      return { from: new Date(asOf.getFullYear(), quarterMonth, 1), to };
    }
    case "year":
      return { from: new Date(asOf.getFullYear(), 0, 1), to };
    default:
      return { from: startOfMonth(asOf), to };
  }
}

export function isValidTerritoryMapNode(node: TerritoryMapNode): boolean {
  return (
    typeof node.territoryId === "string" &&
    node.territoryId.length > 0 &&
    typeof node.territoryName === "string" &&
    typeof node.districtName === "string" &&
    typeof node.divisionName === "string" &&
    Number.isFinite(node.sales) &&
    node.sales >= 0 &&
    Number.isFinite(node.collections) &&
    node.collections >= 0 &&
    Number.isFinite(node.due) &&
    node.due >= 0 &&
    Number.isInteger(node.dealerCount) &&
    node.dealerCount >= 0 &&
    Number.isInteger(node.srCount) &&
    node.srCount >= 0 &&
    ["LOW", "MEDIUM", "HIGH"].includes(node.riskLevel)
  );
}

export function sortNodesByMetric(
  nodes: TerritoryMapNode[],
  metric: TerritoryMapFilters["metric"],
): TerritoryMapNode[] {
  return [...nodes].sort((a, b) => {
    const aVal = a[metric];
    const bVal = b[metric];
    return bVal - aVal;
  });
}
