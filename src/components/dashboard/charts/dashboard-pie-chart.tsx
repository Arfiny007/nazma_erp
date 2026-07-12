"use client";

import type { ChartPoint } from "@/lib/dashboard/analytics";

import { DEFAULT_CHART_DIMENSIONS, buildPieSlices, describeArc, formatChartValue } from "./chart-utils";

interface DashboardPieChartProps {
  data: ChartPoint[];
}

export function DashboardPieChart({ data }: DashboardPieChartProps) {
  const { width, height } = DEFAULT_CHART_DIMENSIONS;
  const cx = width / 2;
  const cy = height / 2 - 8;
  const radius = Math.min(width, height) / 2 - 40;
  const slices = buildPieSlices(data);

  if (slices.length === 0) {
    return null;
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-hidden
    >
      {slices.map((slice) => (
        <path
          key={slice.label}
          d={describeArc(cx, cy, radius, slice.start, slice.end)}
          fill={slice.color}
          opacity={0.92}
        >
          <title>
            {slice.label}: {formatChartValue(slice.value)}
          </title>
        </path>
      ))}
      <g transform={`translate(${paddingX(slices.length)}, ${height - 18})`}>
        {slices.map((slice, index) => (
          <g key={slice.label} transform={`translate(${index * 88}, 0)`}>
            <rect width="8" height="8" rx="2" fill={slice.color} />
            <text x="12" y="8" className="fill-slate-600 text-[10px]">
              {slice.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function paddingX(count: number): number {
  const legendWidth = count * 88;
  const chartWidth = DEFAULT_CHART_DIMENSIONS.width;
  return Math.max(16, (chartWidth - legendWidth) / 2);
}
