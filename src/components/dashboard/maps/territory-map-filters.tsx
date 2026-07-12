"use client";

import type {
  MapMetric,
  MapPeriod,
  TerritoryMapDistrictOption,
  TerritoryMapDivisionOption,
  TerritoryMapFilters,
} from "@/lib/dashboard/maps";

import { useLanguage } from "@/contexts/LanguageContext";

interface TerritoryMapFiltersProps {
  filters: TerritoryMapFilters;
  divisions: TerritoryMapDivisionOption[];
  districts: TerritoryMapDistrictOption[];
  role: string;
  onChange: (filters: TerritoryMapFilters) => void;
  isLoading?: boolean;
}

const METRICS: MapMetric[] = ["sales", "collections", "due", "dealerCount"];
const PERIODS: MapPeriod[] = ["month", "quarter", "year"];

export function TerritoryMapFiltersBar({
  filters,
  divisions,
  districts,
  role,
  onChange,
  isLoading = false,
}: TerritoryMapFiltersProps) {
  const { t } = useLanguage();

  const showGeoFilters = role === "Super_Admin" || role === "Manager";
  const filteredDistricts = filters.divisionId
    ? districts.filter((d) => d.divisionId === filters.divisionId)
    : districts;

  const selectClass =
    "h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 shadow-sm focus:border-[#1a5dad] focus:outline-none focus:ring-1 focus:ring-[#1a5dad] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showGeoFilters ? (
        <>
          <select
            className={selectClass}
            value={filters.divisionId ?? ""}
            disabled={isLoading}
            onChange={(e) =>
              onChange({
                ...filters,
                divisionId: e.target.value || undefined,
                districtId: undefined,
              })
            }
            aria-label={t("dashboard.map.filters.division")}
          >
            <option value="">{t("dashboard.map.filters.allDivisions")}</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filters.districtId ?? ""}
            disabled={isLoading || filteredDistricts.length === 0}
            onChange={(e) =>
              onChange({
                ...filters,
                districtId: e.target.value || undefined,
              })
            }
            aria-label={t("dashboard.map.filters.district")}
          >
            <option value="">{t("dashboard.map.filters.allDistricts")}</option>
            {filteredDistricts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <select
        className={selectClass}
        value={filters.metric}
        disabled={isLoading}
        onChange={(e) =>
          onChange({ ...filters, metric: e.target.value as MapMetric })
        }
        aria-label={t("dashboard.map.filters.metric")}
      >
        {METRICS.map((m) => (
          <option key={m} value={m}>
            {t(`dashboard.map.metrics.${m}`)}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={filters.period}
        disabled={isLoading}
        onChange={(e) =>
          onChange({ ...filters, period: e.target.value as MapPeriod })
        }
        aria-label={t("dashboard.map.filters.period")}
      >
        {PERIODS.map((p) => (
          <option key={p} value={p}>
            {t(`dashboard.map.periods.${p}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
