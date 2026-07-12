"use client";

import type { ChartPoint } from "@/lib/dashboard/analytics";

import {
  CHART_COLORS,
  DEFAULT_CHART_DIMENSIONS,
  buildBarWidth,
  formatChartValue,
  getChartExtents,
} from "./chart-utils";

interface DashboardBarChartProps {
  data: ChartPoint[];
}

export function DashboardBarChart({ data }: DashboardBarChartProps) {
  const { width, height, padding } = DEFAULT_CHART_DIMENSIONS;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const { maxValue } = getChartExtents(data);

  if (data.length === 0) {
    return null;
  }

  const barWidth = buildBarWidth(data.length, innerWidth);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-hidden
    >
      {data.map((point, index) => {
        const barHeight = (point.value / maxValue) * innerHeight;
        const x = padding + index * (barWidth + 8);
        const y = padding + innerHeight - barHeight;
        const color = CHART_COLORS[index % CHART_COLORS.length];

        return (
          <g key={`${point.label}-${index}`}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="4"
              fill={color}
              opacity={0.9}
            />
            <text
              x={x + barWidth / 2}
              y={height - 6}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {point.label}
            </text>
            <title>
              {point.label}: {formatChartValue(point.value)}
            </title>
          </g>
        );
      })}
    </svg>
  );
}
