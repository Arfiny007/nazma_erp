"use client";

import { ChevronDown, ChevronRight, MapPin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { listDistrictsByDivision } from "@/lib/actions/geography/list-districts-by-division";
import { listDivisions } from "@/lib/actions/geography/list-divisions";
import { cn } from "@/lib/utils";
import type { DistrictDTO, DivisionDTO } from "@/types/geography";

type LoadStatus = "loading" | "ready" | "error";

interface DivisionWithDistricts extends DivisionDTO {
  districts: DistrictDTO[];
  expanded: boolean;
}

export function GeographyHierarchy() {
  const { t, locale } = useLanguage();
  const [divisions, setDivisions] = useState<DivisionWithDistricts[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");

  const displayName = useCallback(
    (en: string, bn: string) => (locale === "bn" ? bn : en),
    [locale],
  );

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setStatus("loading");

      const divisionResult = await listDivisions();
      if (cancelled) {
        return;
      }

      if (!divisionResult.success) {
        setStatus("error");
        return;
      }

      const withDistricts: DivisionWithDistricts[] = await Promise.all(
        divisionResult.data.map(async (division) => {
          const districtResult = await listDistrictsByDivision({
            divisionId: division.id,
          });

          return {
            ...division,
            districts: districtResult.success ? districtResult.data : [],
            expanded: false,
          };
        }),
      );

      if (!cancelled) {
        setDivisions(withDistricts);
        setStatus("ready");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleDivision = (divisionId: string): void => {
    setDivisions((current) =>
      current.map((division) =>
        division.id === divisionId
          ? { ...division, expanded: !division.expanded }
          : division,
      ),
    );
  };

  if (status === "loading") {
    return <TableSkeleton rows={8} columns={3} />;
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {t("geography.page.loadError")}
      </div>
    );
  }

  if (divisions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center dark:border-slate-700">
        <MapPin
          aria-hidden="true"
          className="mx-auto mb-3 size-8 text-slate-300 dark:text-slate-600"
        />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("geography.page.empty")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-4 rounded-lg bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
        <span>{t("geography.column.division")}</span>
        <span>{t("geography.column.districtCount")}</span>
        <span>{t("geography.column.code")}</span>
      </div>

      {divisions.map((division) => (
        <div
          key={division.id}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <button
            type="button"
            onClick={() => toggleDivision(division.id)}
            className="grid w-full grid-cols-3 items-center gap-4 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-50">
              {division.expanded ? (
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
              ) : (
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
              )}
              {displayName(division.name, division.nameBn)}
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              {division.districts.length.toString()}
            </span>
            <span className="font-mono text-xs text-slate-500">{division.code}</span>
          </button>

          {division.expanded && division.districts.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/40">
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {division.districts.map((district) => (
                  <li
                    key={district.id}
                    className="grid grid-cols-3 gap-4 px-4 py-2.5 pl-10 text-sm"
                  >
                    <span className="text-slate-700 dark:text-slate-200">
                      {displayName(district.name, district.nameBn)}
                    </span>
                    <span />
                    <span className="font-mono text-xs text-slate-500">{district.code}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
