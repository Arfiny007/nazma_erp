"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { listDivisions } from "@/lib/actions/geography/list-divisions";
import { cn } from "@/lib/utils";
import type { DivisionDTO } from "@/types/geography";

interface DivisionSelectProps {
  value: string | null;
  onChange: (division: DivisionDTO | null) => void;
  disabled?: boolean;
  hasError?: boolean;
  id?: string;
  className?: string;
}

export function DivisionSelect({
  value,
  onChange,
  disabled,
  hasError,
  id,
  className,
}: DivisionSelectProps) {
  const { t, locale } = useLanguage();
  const generatedId = useId();
  const selectId = id ?? generatedId;

  const [items, setItems] = useState<DivisionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setLoadError(false);

      const result = await listDivisions();
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
  }, []);

  const displayName = (division: DivisionDTO): string =>
    locale === "bn" ? division.nameBn : division.name;

  return (
    <div className={cn("relative", className)}>
      <select
        id={selectId}
        value={value ?? ""}
        disabled={disabled || loading}
        aria-invalid={hasError || undefined}
        aria-busy={loading || undefined}
        onChange={(event) => {
          const nextId = event.target.value;
          if (!nextId) {
            onChange(null);
            return;
          }
          const division = items.find((item) => item.id === nextId) ?? null;
          onChange(division);
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
          {loading
            ? t("geography.select.loading")
            : t("geography.select.divisionPlaceholder")}
        </option>
        {items.map((division) => (
          <option key={division.id} value={division.id}>
            {displayName(division)}
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
