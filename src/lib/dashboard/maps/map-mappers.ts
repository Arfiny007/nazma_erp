import { Prisma } from "@prisma/client";

import { decimalToChartValue } from "@/lib/dashboard/analytics/analytics-mappers";

import { classifyTerritoryRisk } from "./map-validation";
import type { TerritoryMapNode } from "./map-types";

const ZERO = new Prisma.Decimal(0);

export interface TerritoryGeoRow {
  id: string;
  name: string;
  district: {
    name: string;
    division: { id: string; name: string };
    id: string;
    divisionId: string;
  };
}

export interface TerritoryMetricRow {
  territoryId: string;
  sales: Prisma.Decimal;
  collections: Prisma.Decimal;
  due: Prisma.Decimal;
  dealerCount: number;
  srCount: number;
}

export function buildTerritoryMapNode(
  geo: TerritoryGeoRow,
  metrics: TerritoryMetricRow,
): TerritoryMapNode {
  const sales = decimalToChartValue(metrics.sales);
  const collections = decimalToChartValue(metrics.collections);
  const due = decimalToChartValue(metrics.due);

  return {
    territoryId: geo.id,
    territoryName: geo.name,
    districtName: geo.district.name,
    divisionName: geo.district.division.name,
    sales,
    collections,
    due,
    dealerCount: Math.max(0, metrics.dealerCount),
    srCount: Math.max(0, metrics.srCount),
    riskLevel: classifyTerritoryRisk(due, collections, sales),
  };
}

export function emptyMetricsForTerritory(territoryId: string): TerritoryMetricRow {
  return {
    territoryId,
    sales: ZERO,
    collections: ZERO,
    due: ZERO,
    dealerCount: 0,
    srCount: 0,
  };
}

export function extractDivisionOptions(
  territories: TerritoryGeoRow[],
): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const t of territories) {
    const div = t.district.division;
    if (!seen.has(div.id)) {
      seen.set(div.id, div.name);
    }
  }
  return [...seen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function extractDistrictOptions(
  territories: TerritoryGeoRow[],
): { id: string; name: string; divisionId: string }[] {
  const seen = new Map<string, { name: string; divisionId: string }>();
  for (const t of territories) {
    if (!seen.has(t.district.id)) {
      seen.set(t.district.id, {
        name: t.district.name,
        divisionId: t.district.divisionId,
      });
    }
  }
  return [...seen.entries()]
    .map(([id, row]) => ({ id, name: row.name, divisionId: row.divisionId }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
