"use client";

import Link from "next/link";

import type { DashboardChart } from "@/lib/dashboard/analytics";
import { useLanguage } from "@/contexts/LanguageContext";

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
      return (
        <DashboardBarChart
          data={chart.data}
          orientation={chart.orientation ?? "vertical"}
        />
      );
    case "pie":
      return <DashboardPieChart data={chart.data} />;
    case "area":
      return <DashboardAreaChart data={chart.data} />;
    default:
      return null;
  }
}

export function DashboardChartRenderer({ chart }: DashboardChartRendererProps) {
  const { t } = useLanguage();

  return (
    <DashboardChartCard titleKey={chart.titleKey}>
      {chart.data.length === 0 ? (
        <DashboardChartEmpty />
      ) : (
        <>
          {renderChart(chart)}
          {chart.href ? (
            <div className="mt-3">
              <Link
                href={chart.href}
                className="text-xs font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-400"
              >
                {t(
                  chart.hrefLabelKey ??
                    "dashboard.analytics.charts.viewTerritoryBreakdown",
                )}
              </Link>
            </div>
          ) : null}
        </>
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
