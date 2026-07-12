import type { UserRole } from "@prisma/client";

/**
 * Enterprise Dashboard Analytics types — PHASE_09B.
 *
 * Chart contracts are presentation-only. Monetary aggregation happens server-side
 * via certified read engines and operational Prisma aggregates.
 *
 * @see ADR-044
 */

export type DashboardChartType = "line" | "bar" | "pie" | "area";

export interface ChartPoint {
  label: string;
  value: number;
}

export interface DashboardChart {
  id: string;
  titleKey: string;
  type: DashboardChartType;
  data: ChartPoint[];
}

export interface TerritoryHeatmapPoint {
  territoryId: string;
  territoryName: string;
  sales: number;
  collections: number;
  due: number;
}

export type AnalyticsRole = Extract<
  UserRole,
  "SR" | "Manager" | "Accounts" | "Super_Admin"
>;

export interface SrAnalyticsPayload {
  role: "SR";
  charts: DashboardChart[];
  generatedAt: string;
}

export interface ManagerAnalyticsPayload {
  role: "Manager";
  charts: DashboardChart[];
  generatedAt: string;
}

export interface AccountsAnalyticsPayload {
  role: "Accounts";
  charts: DashboardChart[];
  generatedAt: string;
}

export interface AdminAnalyticsPayload {
  role: "Super_Admin";
  charts: DashboardChart[];
  territoryHeatmap: TerritoryHeatmapPoint[];
  generatedAt: string;
}

export type AnalyticsPayload =
  | SrAnalyticsPayload
  | ManagerAnalyticsPayload
  | AccountsAnalyticsPayload
  | AdminAnalyticsPayload;

export interface AnalyticsContext {
  userId: string;
  role: AnalyticsRole;
}

export const DEFAULT_TREND_MONTHS = 6;
