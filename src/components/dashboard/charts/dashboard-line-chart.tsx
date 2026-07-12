"use client";

import type { ChartPoint } from "@/lib/dashboard/analytics";

import {
  DEFAULT_CHART_DIMENSIONS,
  buildLinearScale,
  formatChartValue,
  getChartExtents,
} from "./chart-utils";

interface DashboardLineChartProps {
  data: ChartPoint[];
  color?: string;
}

export function DashboardLineChart({
  data,
  color = "#1a5dad",
}: DashboardLineChartProps) {
  const { width, height, padding } = DEFAULT_CHART_DIMENSIONS;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const { maxValue } = getChartExtents(data);

  if (data.length === 0) {
    return null;
  }

  const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0;
  const points = data
    .map((point, index) => {
      const x = padding + index * stepX;
      const y = padding + buildLinearScale(point.value, maxValue, innerHeight);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {data.map((point, index) => {
        const x = padding + index * stepX;
        const y = padding + buildLinearScale(point.value, maxValue, innerHeight);
        return (
          <g key={`${point.label}-${index}`}>
            <circle cx={x} cy={y} r="4" fill={color} />
            <text
              x={x}
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
