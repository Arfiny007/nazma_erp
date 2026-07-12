import type { ChartPoint } from "@/lib/dashboard/analytics";

export const CHART_COLORS = [
  "#1a5dad",
  "#0d9488",
  "#6366f1",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
] as const;

export interface ChartDimensions {
  width: number;
  height: number;
  padding: number;
}

export const DEFAULT_CHART_DIMENSIONS: ChartDimensions = {
  width: 480,
  height: 220,
  padding: 32,
};

export function getChartExtents(points: readonly ChartPoint[]) {
  const values = points.map((point) => point.value);
  const maxValue = values.length > 0 ? Math.max(...values, 0) : 0;
  return {
    maxValue: maxValue === 0 ? 1 : maxValue,
    minValue: 0,
  };
}

export function buildLinearScale(
  value: number,
  maxValue: number,
  innerHeight: number,
): number {
  if (maxValue <= 0) {
    return innerHeight;
  }
  return innerHeight - (value / maxValue) * innerHeight;
}

export function buildBarWidth(
  count: number,
  innerWidth: number,
  gap = 8,
): number {
  if (count <= 0) {
    return 0;
  }
  return Math.max(12, (innerWidth - gap * (count - 1)) / count);
}

export function formatChartValue(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function buildPieSlices(points: readonly ChartPoint[]) {
  const total = points.reduce((sum, point) => sum + point.value, 0);
  if (total <= 0) {
    return [];
  }

  let cursor = 0;
  return points.map((point, index) => {
    const fraction = point.value / total;
    const start = cursor;
    cursor += fraction;
    return {
      ...point,
      start,
      end: cursor,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
  });
}

export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  fraction: number,
) {
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startFraction: number,
  endFraction: number,
): string {
  const start = polarToCartesian(cx, cy, radius, endFraction);
  const end = polarToCartesian(cx, cy, radius, startFraction);
  const largeArc = endFraction - startFraction > 0.5 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}
