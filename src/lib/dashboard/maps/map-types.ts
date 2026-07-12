import type { UserRole } from "@prisma/client";

/**
 * Enterprise Territory Map types — PHASE_09C.
 *
 * Presentation-only geo visualization consuming analytics DTOs.
 * No financial calculations — maps display pre-aggregated metrics only.
 *
 * @see ADR-045
 */

export type MapMetric = "sales" | "collections" | "due" | "dealerCount";

export type MapPeriod = "month" | "quarter" | "year";

export type TerritoryRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface TerritoryMapFilters {
  divisionId?: string;
  districtId?: string;
  metric: MapMetric;
  period: MapPeriod;
}

export interface TerritoryMapNode {
  territoryId: string;
  territoryName: string;
  districtName: string;
  divisionName: string;
  sales: number;
  collections: number;
  due: number;
  dealerCount: number;
  srCount: number;
  riskLevel: TerritoryRiskLevel;
}

export interface TerritoryMapDivisionOption {
  id: string;
  name: string;
}

export interface TerritoryMapDistrictOption {
  id: string;
  name: string;
  divisionId: string;
}

export type MapRole = Extract<
  UserRole,
  "SR" | "Manager" | "Accounts" | "Super_Admin"
>;

export interface TerritoryMapPayload {
  role: MapRole;
  nodes: TerritoryMapNode[];
  divisions: TerritoryMapDivisionOption[];
  districts: TerritoryMapDistrictOption[];
  filters: TerritoryMapFilters;
  generatedAt: string;
}

export interface MapContext {
  userId: string;
  role: MapRole;
}

export const DEFAULT_MAP_FILTERS: TerritoryMapFilters = {
  metric: "sales",
  period: "month",
};
