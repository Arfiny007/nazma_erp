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
  orientation?: "horizontal" | "vertical";
}

export function DashboardBarChart({
  data,
  orientation = "vertical",
}: DashboardBarChartProps) {
  if (data.length === 0) {
    return null;
  }

  if (orientation === "horizontal") {
    return <HorizontalBarChart data={data} />;
  }

  return <VerticalBarChart data={data} />;
}

function VerticalBarChart({ data }: { data: ChartPoint[] }) {
  const { width, height, padding } = DEFAULT_CHART_DIMENSIONS;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const { maxValue } = getChartExtents(data);
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
        const display = point.valueLabel ?? formatChartValue(point.value);

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
              {point.label.length > 12
                ? `${point.label.slice(0, 11)}…`
                : point.label}
            </text>
            <title>
              {point.meta?.productCode
                ? `${point.meta.productCode} — ${point.label}`
                : point.label}
              : {display}
              {point.meta?.territoryCount != null
                ? ` · ${point.meta.territoryCount} territories`
                : ""}
            </title>
          </g>
        );
      })}
    </svg>
  );
}

function HorizontalBarChart({ data }: { data: ChartPoint[] }) {
  const width = 520;
  const rowHeight = 28;
  const labelWidth = 140;
  const paddingRight = 56;
  const height = Math.max(180, data.length * rowHeight + 16);
  const { maxValue } = getChartExtents(data);
  const barMaxWidth = width - labelWidth - paddingRight - 16;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-hidden
    >
      {data.map((point, index) => {
        const y = 8 + index * rowHeight;
        const barWidth = (point.value / maxValue) * barMaxWidth;
        const color = CHART_COLORS[index % CHART_COLORS.length];
        const display = point.valueLabel ?? formatChartValue(point.value);
        const label =
          point.label.length > 22
            ? `${point.label.slice(0, 21)}…`
            : point.label;

        return (
          <g key={`${point.label}-${index}`}>
            <text
              x={labelWidth - 8}
              y={y + 14}
              textAnchor="end"
              className="fill-slate-600 text-[11px]"
            >
              {label}
            </text>
            <rect
              x={labelWidth}
              y={y + 4}
              width={Math.max(2, barWidth)}
              height={16}
              rx="3"
              fill={color}
              opacity={0.9}
            />
            <text
              x={labelWidth + Math.max(2, barWidth) + 6}
              y={y + 15}
              className="fill-slate-500 text-[10px] tabular-nums"
            >
              {display}
            </text>
            <title>
              {point.meta?.productCode
                ? `${point.meta.productCode} — ${point.label}`
                : point.label}
              : {display}
              {point.meta?.territoryCount != null
                ? ` · ${point.meta.territoryCount} territories`
                : ""}
            </title>
          </g>
        );
      })}
    </svg>
  );
}
