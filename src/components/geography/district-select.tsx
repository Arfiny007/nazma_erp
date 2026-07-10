"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { listDistrictsByDivision } from "@/lib/actions/geography/list-districts-by-division";
import { cn } from "@/lib/utils";
import type { DistrictDTO } from "@/types/geography";

interface DistrictSelectProps {
  divisionId: string | null;
  value: string | null;
  onChange: (district: DistrictDTO | null) => void;
  disabled?: boolean;
  hasError?: boolean;
  id?: string;
  className?: string;
}

export function DistrictSelect({
  divisionId,
  value,
  onChange,
  disabled,
  hasError,
  id,
  className,
}: DistrictSelectProps) {
  const { t, locale } = useLanguage();
  const generatedId = useId();
  const selectId = id ?? generatedId;

  const [items, setItems] = useState<DistrictDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!divisionId) {
      setItems([]);
      setLoading(false);
      setLoadError(false);
      onChange(null);
      return;
    }

    async function load(): Promise<void> {
      setLoading(true);
      setLoadError(false);

      const result = await listDistrictsByDivision({ divisionId });
      if (cancelled) {
        return;
      }

      if (!result.success) {
        setLoadError(true);
        setItems([]);
      } else {
        setItems(result.data);
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset selection when division changes
  }, [divisionId]);

  const displayName = (district: DistrictDTO): string =>
    locale === "bn" ? district.nameBn : district.name;

  const isDisabled = disabled || !divisionId || loading;

  return (
    <div className={cn("relative", className)}>
      <select
        id={selectId}
        value={value ?? ""}
        disabled={isDisabled}
        aria-invalid={hasError || undefined}
        aria-busy={loading || undefined}
        onChange={(event) => {
          const nextId = event.target.value;
          if (!nextId) {
            onChange(null);
            return;
          }
          const district = items.find((item) => item.id === nextId) ?? null;
          onChange(district);
        }}
        className={cn(
          "w-full appearance-none rounded-lg border bg-white px-3 py-2 pr-9 text-sm text-slate-900 shadow-sm transition-colors",
          "focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-slate-500 dark:focus:ring-slate-800",
          hasError && "border-red-500 focus:border-red-500 focus:ring-red-100",
        )}
      >
        <option value="">
          {!divisionId
            ? t("geography.select.selectDivisionFirst")
            : loading
              ? t("geography.select.loading")
              : t("geography.select.districtPlaceholder")}
        </option>
        {items.map((district) => (
          <option key={district.id} value={district.id}>
            {displayName(district)}
          </option>
        ))}
      </select>

      {loading && (
        <Loader2
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-400"
        />
      )}

      {loadError && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {t("geography.select.loadError")}
        </p>
      )}
    </div>
  );
}
