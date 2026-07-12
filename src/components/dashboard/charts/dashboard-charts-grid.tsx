"use client";

import type { DashboardChart } from "@/lib/dashboard/analytics";

import { DashboardAreaChart } from "./dashboard-area-chart";
import { DashboardBarChart } from "./dashboard-bar-chart";
import { DashboardChartCard } from "./dashboard-chart-card";
import { DashboardChartEmpty } from "./dashboard-chart-empty";
import { DashboardLineChart } from "./dashboard-line-chart";
import { DashboardPieChart } from "./dashboard-pie-chart";

interface DashboardChartRendererProps {
  chart: DashboardChart;
}

function renderChart(chart: DashboardChart) {
  switch (chart.type) {
    case "line":
      return <DashboardLineChart data={chart.data} />;
    case "bar":
      return <DashboardBarChart data={chart.data} />;
    case "pie":
      return <DashboardPieChart data={chart.data} />;
    case "area":
      return <DashboardAreaChart data={chart.data} />;
    default:
      return null;
  }
}

export function DashboardChartRenderer({ chart }: DashboardChartRendererProps) {
  return (
    <DashboardChartCard titleKey={chart.titleKey}>
      {chart.data.length === 0 ? (
        <DashboardChartEmpty />
      ) : (
        renderChart(chart)
      )}
    </DashboardChartCard>
  );
}

interface DashboardChartsGridProps {
  charts: DashboardChart[];
}

export function DashboardChartsGrid({ charts }: DashboardChartsGridProps) {
  if (charts.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
      {charts.map((chart) => (
        <DashboardChartRenderer key={chart.id} chart={chart} />
      ))}
    </section>
  );
}
