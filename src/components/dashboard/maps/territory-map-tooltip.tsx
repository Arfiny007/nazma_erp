"use client";

import type { TerritoryMapNode } from "@/lib/dashboard/maps";
import type { MapMetric } from "@/lib/dashboard/maps";

import { formatMetricValue } from "./map-utils";

interface TerritoryMapTooltipProps {
  node: TerritoryMapNode;
  metric: MapMetric;
}

export function TerritoryMapTooltip({ node, metric }: TerritoryMapTooltipProps) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-52 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg group-hover:block dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-semibold text-slate-900 dark:text-slate-50">
        {node.territoryName}
      </p>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        {node.districtName} · {node.divisionName}
      </p>
      <dl className="mt-2 space-y-1 text-[10px]">
        <div className="flex justify-between">
          <dt className="text-slate-500">Sales</dt>
          <dd className="font-medium">{formatMetricValue("sales", node.sales)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Collections</dt>
          <dd className="font-medium">
            {formatMetricValue("collections", node.collections)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Due</dt>
          <dd className="font-medium">{formatMetricValue("due", node.due)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Dealers</dt>
          <dd className="font-medium">{node.dealerCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">SRs</dt>
          <dd className="font-medium">{node.srCount}</dd>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-1 dark:border-slate-800">
          <dt className="text-slate-500">Selected</dt>
          <dd className="font-semibold text-[#1a5dad]">
            {formatMetricValue(metric, node[metric])}
          </dd>
        </div>
      </dl>
    </div>
  );
}
