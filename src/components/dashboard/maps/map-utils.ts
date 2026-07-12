"use client";

import type { MapMetric } from "@/lib/dashboard/maps";

import { formatChartValue } from "../charts/chart-utils";

export const RISK_COLORS = {
  LOW: { border: "#0d9488", bg: "rgba(13, 148, 136, 0.12)" },
  MEDIUM: { border: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)" },
  HIGH: { border: "#ef4444", bg: "rgba(239, 68, 68, 0.12)" },
} as const;

export const METRIC_COLOR = "#1a5dad";

export function getMetricValue(
  node: {
    sales: number;
    collections: number;
    due: number;
    dealerCount: number;
  },
  metric: MapMetric,
): number {
  return node[metric];
}

export function formatMetricValue(metric: MapMetric, value: number): string {
  if (metric === "dealerCount") {
    return value.toLocaleString();
  }
  return `৳${formatChartValue(value)}`;
}

export function interpolateMetricColor(
  value: number,
  maxValue: number,
): string {
  if (maxValue <= 0 || value <= 0) {
    return "rgba(26, 93, 173, 0.08)";
  }
  const intensity = Math.min(value / maxValue, 1);
  const alpha = 0.15 + intensity * 0.65;
  return `rgba(26, 93, 173, ${alpha.toFixed(2)})`;
}

export function groupNodesByDivision<
  T extends { divisionName: string; districtName: string },
>(nodes: T[]): Map<string, Map<string, T[]>> {
  const result = new Map<string, Map<string, T[]>>();
  for (const node of nodes) {
    const divKey = node.divisionName;
    if (!result.has(divKey)) {
      result.set(divKey, new Map());
    }
    const districtMap = result.get(divKey)!;
    const distKey = node.districtName;
    if (!districtMap.has(distKey)) {
      districtMap.set(distKey, []);
    }
    districtMap.get(distKey)!.push(node);
  }
  return result;
}
