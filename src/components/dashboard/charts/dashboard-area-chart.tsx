"use client";

import type { ChartPoint } from "@/lib/dashboard/analytics";

import {
  DEFAULT_CHART_DIMENSIONS,
  buildLinearScale,
  formatChartValue,
  getChartExtents,
} from "./chart-utils";

interface DashboardAreaChartProps {
  data: ChartPoint[];
  color?: string;
}

export function DashboardAreaChart({
  data,
  color = "#1a5dad",
}: DashboardAreaChartProps) {
  const { width, height, padding } = DEFAULT_CHART_DIMENSIONS;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const { maxValue } = getChartExtents(data);

  if (data.length === 0) {
    return null;
  }

  const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0;
  const linePoints = data.map((point, index) => {
    const x = padding + index * stepX;
    const y = padding + buildLinearScale(point.value, maxValue, innerHeight);
    return { x, y, point };
  });

  const areaPath = [
    `M ${linePoints[0]?.x ?? padding} ${padding + innerHeight}`,
    ...linePoints.map((point) => `L ${point.x} ${point.y}`),
    `L ${linePoints[linePoints.length - 1]?.x ?? padding} ${padding + innerHeight}`,
    "Z",
  ].join(" ");

  const polyline = linePoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-hidden
    >
      <path d={areaPath} fill={color} fillOpacity={0.15} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
      />
      {linePoints.map((point, index) => (
        <g key={`${point.point.label}-${index}`}>
          <circle cx={point.x} cy={point.y} r="3.5" fill={color} />
          <text
            x={point.x}
            y={height - 6}
            textAnchor="middle"
            className="fill-slate-500 text-[10px]"
          >
            {point.point.label}
          </text>
          <title>
            {point.point.label}: {formatChartValue(point.point.value)}
          </title>
        </g>
      ))}
    </svg>
  );
}
