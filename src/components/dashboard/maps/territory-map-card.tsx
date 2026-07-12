"use client";

import { useCallback, useState, useTransition } from "react";

import { getTerritoryMap } from "@/lib/actions/dashboard";
import type { TerritoryMapFilters, TerritoryMapPayload } from "@/lib/dashboard/maps";

import { useLanguage } from "@/contexts/LanguageContext";

import { TerritoryMapEmpty } from "./territory-map-empty";
import { TerritoryMapFiltersBar } from "./territory-map-filters";
import { TerritoryMapLegend } from "./territory-map-legend";
import { TerritoryMapSkeleton } from "./territory-map-skeleton";
import { TerritoryMap } from "./territory-map";

interface TerritoryMapCardProps {
  initialPayload: TerritoryMapPayload | null;
  initialErrorKey?: string | null;
}

export function TerritoryMapCard({
  initialPayload,
  initialErrorKey = null,
}: TerritoryMapCardProps) {
  const { t } = useLanguage();
  const [payload, setPayload] = useState(initialPayload);
  const [errorKey, setErrorKey] = useState(initialErrorKey);
  const [isPending, startTransition] = useTransition();

  const handleFilterChange = useCallback((filters: TerritoryMapFilters) => {
    startTransition(async () => {
      const result = await getTerritoryMap(filters);
      if (result.success) {
        setPayload(result.data);
        setErrorKey(null);
      } else {
        setErrorKey(result.error.messageKey);
      }
    });
  }, []);

  if (!payload && !errorKey && isPending) {
    return <TerritoryMapSkeleton />;
  }

  if (errorKey) {
    return (
      <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <TerritoryMapEmpty descriptionKey={errorKey} />
      </article>
    );
  }

  if (!payload) {
    return <TerritoryMapSkeleton />;
  }

  const isEmpty = payload.nodes.length === 0;

  return (
    <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t("dashboard.map.sectionTitle")}
        </h3>
        <TerritoryMapFiltersBar
          filters={payload.filters}
          divisions={payload.divisions}
          districts={payload.districts}
          role={payload.role}
          onChange={handleFilterChange}
          isLoading={isPending}
        />
      </div>

      {isEmpty ? (
        <TerritoryMapEmpty />
      ) : (
        <div className={isPending ? "opacity-60 transition-opacity" : ""}>
          <TerritoryMap
            nodes={payload.nodes}
            metric={payload.filters.metric}
            role={payload.role}
          />
          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <TerritoryMapLegend />
          </div>
        </div>
      )}
    </article>
  );
}
