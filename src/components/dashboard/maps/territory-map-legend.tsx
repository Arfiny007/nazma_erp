"use client";

import { useLanguage } from "@/contexts/LanguageContext";

import { RISK_COLORS } from "./map-utils";

export function TerritoryMapLegend() {
  const { t } = useLanguage();

  const riskLevels = [
    { key: "LOW" as const, labelKey: "dashboard.map.risk.low" },
    { key: "MEDIUM" as const, labelKey: "dashboard.map.risk.medium" },
    { key: "HIGH" as const, labelKey: "dashboard.map.risk.high" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
      <span className="font-medium text-slate-700 dark:text-slate-300">
        {t("dashboard.map.legend.risk")}
      </span>
      {riskLevels.map(({ key, labelKey }) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm border-2"
            style={{
              borderColor: RISK_COLORS[key].border,
              backgroundColor: RISK_COLORS[key].bg,
            }}
            aria-hidden
          />
          {t(labelKey)}
        </span>
      ))}
      <span className="ml-2 text-slate-400">|</span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-8 rounded-sm"
          style={{
            background:
              "linear-gradient(to right, rgba(26,93,173,0.15), rgba(26,93,173,0.8))",
          }}
          aria-hidden
        />
        {t("dashboard.map.legend.intensity")}
      </span>
    </div>
  );
}
