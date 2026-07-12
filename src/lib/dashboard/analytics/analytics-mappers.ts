import { Prisma } from "@prisma/client";

import type { CompanyDueSummary } from "@/lib/reports/due";
import type { FinancialIntegrityScanRecord } from "@/lib/ledger/monitor";

import type {
  ChartPoint,
  DashboardChart,
  DashboardChartType,
  TerritoryHeatmapPoint,
} from "./analytics-types";

const ZERO = new Prisma.Decimal(0);

export function decimalToChartValue(amount: Prisma.Decimal): number {
  const value = amount.toNumber();
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function mapDecimalTrendToChart(
  id: string,
  titleKey: string,
  type: DashboardChartType,
  trend: readonly { label: string; amount: Prisma.Decimal }[],
): DashboardChart {
  return {
    id,
    titleKey,
    type,
    data: trend.map((point) => ({
      label: point.label,
      value: decimalToChartValue(point.amount),
    })),
  };
}

export function mapCountTrendToChart(
  id: string,
  titleKey: string,
  type: DashboardChartType,
  trend: readonly { label: string; count: number }[],
): DashboardChart {
  return {
    id,
    titleKey,
    type,
    data: trend.map((point) => ({
      label: point.label,
      value: Math.max(0, point.count),
    })),
  };
}

export function mapRatioTrendToChart(
  id: string,
  titleKey: string,
  trend: readonly { label: string; ratio: number }[],
): DashboardChart {
  return {
    id,
    titleKey,
    type: "line",
    data: trend.map((point) => ({
      label: point.label,
      value: Math.max(0, Math.min(100, point.ratio)),
    })),
  };
}

export function mapTerritoryComparisonChart(
  id: string,
  titleKey: string,
  rows: readonly {
    territoryName: string;
    value: Prisma.Decimal;
  }[],
): DashboardChart {
  return {
    id,
    titleKey,
    type: "bar",
    data: rows.map((row) => ({
      label: row.territoryName,
      value: decimalToChartValue(row.value),
    })),
  };
}

export function mapSrLeaderboardChart(
  id: string,
  titleKey: string,
  rows: readonly { srName: string; value: Prisma.Decimal }[],
): DashboardChart {
  return {
    id,
    titleKey,
    type: "bar",
    data: rows.map((row) => ({
      label: row.srName,
      value: decimalToChartValue(row.value),
    })),
  };
}

export function mapRiskDealerChart(
  dealers: readonly {
    dealerName: string;
    currentBalance: Prisma.Decimal;
  }[],
): DashboardChart {
  return {
    id: "riskDealers",
    titleKey: "dashboard.analytics.charts.riskDealers",
    type: "bar",
    data: dealers.map((dealer) => ({
      label: dealer.dealerName,
      value: decimalToChartValue(dealer.currentBalance),
    })),
  };
}

export function mapAgingBucketChart(
  aging: CompanyDueSummary["aging"],
): DashboardChart {
  const buckets: ChartPoint[] = [
    { label: "Current", value: decimalToChartValue(aging.current) },
    { label: "1-30", value: decimalToChartValue(aging.days30) },
    { label: "31-60", value: decimalToChartValue(aging.days60) },
    { label: "61-90", value: decimalToChartValue(aging.days90) },
    { label: "90+", value: decimalToChartValue(aging.days90Plus) },
  ].filter((point) => point.value > 0);

  return {
    id: "dueAging",
    titleKey: "dashboard.analytics.charts.dueAging",
    type: "pie",
    data: buckets,
  };
}

export function mapIntegrityOverviewChart(
  scan: FinancialIntegrityScanRecord | null,
): DashboardChart {
  if (!scan) {
    return {
      id: "integrityOverview",
      titleKey: "dashboard.analytics.charts.integrityOverview",
      type: "pie",
      data: [],
    };
  }

  const data: ChartPoint[] = [
    {
      label: "Consistent",
      value: scan.consistentDealers,
    },
    {
      label: "Drift",
      value: scan.driftedDealers,
    },
    {
      label: "Missing Ledger",
      value: scan.missingLedgerDealers,
    },
    {
      label: "Corrupted",
      value: scan.corruptedDealers,
    },
  ].filter((point) => point.value > 0);

  return {
    id: "integrityOverview",
    titleKey: "dashboard.analytics.charts.integrityOverview",
    type: "pie",
    data,
  };
}

export function mapReceivableTrendChart(
  trend: readonly { label: string; amount: Prisma.Decimal }[],
  currentNetReceivable: Prisma.Decimal,
): DashboardChart {
  const data = trend.map((point) => ({
    label: point.label,
    value: decimalToChartValue(point.amount),
  }));

  if (data.length > 0 && !currentNetReceivable.isZero()) {
    const last = data[data.length - 1];
    if (last) {
      last.value = decimalToChartValue(currentNetReceivable);
    }
  }

  return {
    id: "receivableTrend",
    titleKey: "dashboard.analytics.charts.receivableTrend",
    type: "area",
    data,
  };
}

export function mapTerritoryHeatmap(
  salesRows: readonly {
    territoryId: string;
    territoryName: string;
    sales: Prisma.Decimal;
    collections: Prisma.Decimal;
  }[],
  dueMap: Map<string, { name: string; due: Prisma.Decimal }>,
): TerritoryHeatmapPoint[] {
  return salesRows.map((row) => {
    const dueEntry = dueMap.get(row.territoryId);
    return {
      territoryId: row.territoryId,
      territoryName: row.territoryName,
      sales: decimalToChartValue(row.sales),
      collections: decimalToChartValue(row.collections),
      due: decimalToChartValue(dueEntry?.due ?? ZERO),
    };
  });
}

export function buildAnalyticsPayload<T extends { charts: DashboardChart[]; generatedAt: string }>(
  payload: T,
): T {
  return payload;
}
