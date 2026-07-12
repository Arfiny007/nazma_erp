import type { UserRole } from "@prisma/client";

import type { TerritoryScope } from "@/lib/rbac/territory";

import {
  EmptyAnalyticsScopeError,
  UnsupportedAnalyticsRoleError,
} from "./analytics-errors";
import type { AnalyticsContext, AnalyticsRole, ChartPoint, DashboardChart } from "./analytics-types";

const ANALYTICS_ROLES: readonly AnalyticsRole[] = [
  "SR",
  "Manager",
  "Accounts",
  "Super_Admin",
];

export function assertAnalyticsRole(role: UserRole): AnalyticsRole {
  if (!ANALYTICS_ROLES.includes(role as AnalyticsRole)) {
    throw new UnsupportedAnalyticsRoleError(role);
  }
  return role as AnalyticsRole;
}

export function assertAnalyticsScope(scope: TerritoryScope): void {
  if (scope.mode === "NONE") {
    throw new EmptyAnalyticsScopeError();
  }
  if (scope.mode === "TERRITORIES" && scope.territoryIds.length === 0) {
    throw new EmptyAnalyticsScopeError();
  }
}

export function buildAnalyticsContext(
  userId: string,
  role: UserRole,
): AnalyticsContext {
  return {
    userId,
    role: assertAnalyticsRole(role),
  };
}

export function isValidChartPoint(point: ChartPoint): boolean {
  return (
    typeof point.label === "string" &&
    point.label.length > 0 &&
    typeof point.value === "number" &&
    Number.isFinite(point.value) &&
    point.value >= 0
  );
}

export function isValidDashboardChart(chart: DashboardChart): boolean {
  return (
    typeof chart.id === "string" &&
    chart.id.length > 0 &&
    typeof chart.titleKey === "string" &&
    chart.titleKey.length > 0 &&
    ["line", "bar", "pie", "area"].includes(chart.type) &&
    Array.isArray(chart.data) &&
    chart.data.every(isValidChartPoint)
  );
}

export function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function monthRange(
  asOf: Date,
  monthsBack: number,
  offset: number,
): { start: Date; end: Date; label: string } {
  const start = new Date(asOf.getFullYear(), asOf.getMonth() - offset, 1);
  const end =
    offset === 0
      ? asOf
      : endOfMonth(new Date(asOf.getFullYear(), asOf.getMonth() - offset, 1));
  return { start, end, label: monthLabel(start) };
}
