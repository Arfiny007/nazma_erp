"use client";

import type { MapMetric, TerritoryMapNode } from "@/lib/dashboard/maps";

import { useLanguage } from "@/contexts/LanguageContext";

import {
  formatMetricValue,
  getMetricValue,
  groupNodesByDivision,
  interpolateMetricColor,
  RISK_COLORS,
} from "./map-utils";
import { TerritoryMapTooltip } from "./territory-map-tooltip";

interface TerritoryMapProps {
  nodes: TerritoryMapNode[];
  metric: MapMetric;
  role: string;
  highlightRisk?: boolean;
  simplified?: boolean;
}

export function TerritoryMap({
  nodes,
  metric,
  role,
  highlightRisk = role === "Super_Admin" || role === "Manager",
  simplified = role === "SR",
}: TerritoryMapProps) {
  const { t } = useLanguage();

  const maxValue = Math.max(...nodes.map((n) => getMetricValue(n, metric)), 1);
  const grouped = groupNodesByDivision(nodes);

  return (
    <div className="space-y-6">
      {[...grouped.entries()].map(([divisionName, districtMap]) => (
        <div key={divisionName} className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {divisionName}
          </h4>
          {[...districtMap.entries()].map(([districtName, districtNodes]) => (
            <div key={districtName} className="space-y-1.5">
              {!simplified ? (
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  {districtName}
                </p>
              ) : null}
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: simplified
                    ? "repeat(auto-fill, minmax(72px, 1fr))"
                    : "repeat(auto-fill, minmax(96px, 1fr))",
                }}
              >
                {districtNodes.map((node) => {
                  const value = getMetricValue(node, metric);
                  const riskStyle = RISK_COLORS[node.riskLevel];
                  const bg = interpolateMetricColor(value, maxValue);

                  return (
                    <div
                      key={node.territoryId}
                      className="group relative"
                      title={`${node.territoryName}: ${formatMetricValue(metric, value)}`}
                    >
                      <TerritoryMapTooltip node={node} metric={metric} />
                      <div
                        className="flex min-h-[3.5rem] flex-col justify-between rounded-lg border-2 p-2 transition-shadow hover:shadow-md"
                        style={{
                          backgroundColor: bg,
                          borderColor: highlightRisk
                            ? riskStyle.border
                            : "transparent",
                        }}
                      >
                        <span className="truncate text-[10px] font-medium leading-tight text-slate-800 dark:text-slate-100">
                          {node.territoryName}
                        </span>
                        <span className="text-[10px] font-semibold text-[#1a5dad]">
                          {formatMetricValue(metric, value)}
                        </span>
                        {!simplified && node.riskLevel === "HIGH" ? (
                          <span className="text-[9px] font-medium text-red-600">
                            {t("dashboard.map.risk.high")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
