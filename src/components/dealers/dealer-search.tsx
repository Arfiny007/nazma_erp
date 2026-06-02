"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface DealerSearchProps {
  /** Current committed search value (source of truth). */
  value: string;
  /** Fired with the debounced, trimmed search term. */
  onChange: (value: string) => void;
  /** Debounce window in milliseconds. */
  debounceMs?: number;
  className?: string;
}

/**
 * Debounced free-text search input for the dealer list. Keeps a responsive
 * local value while only propagating committed terms after the debounce window.
 */
export function DealerSearch({
  value,
  onChange,
  debounceMs = 300,
  className,
}: DealerSearchProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(value);
  const [committedValue, setCommittedValue] = useState(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Adjust the local draft during render when the committed value changes from
  // the outside (e.g. an external reset). This is React's recommended pattern
  // and avoids syncing state inside an effect.
  if (value !== committedValue) {
    setCommittedValue(value);
    setDraft(value);
  }

  useEffect(() => {
    const trimmed = draft.trim();
    if (trimmed === value) {
      return;
    }

    const timer = window.setTimeout(() => {
      onChangeRef.current(trimmed);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [draft, value, debounceMs]);

  const handleClear = () => {
    setDraft("");
    onChangeRef.current("");
  };

  return (
    <div className={cn("relative w-full sm:max-w-sm", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
      />
      <input
        type="search"
        inputMode="search"
        autoComplete="off"
        aria-label={t("dealers.search.label")}
        placeholder={t("dealers.search.placeholder")}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className={cn(
          "w-full rounded-lg border border-slate-200/80 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 shadow-sm transition-colors",
          "placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20",
          "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-600",
        )}
      />
      {draft.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={t("dealers.search.clear")}
          className={cn(
            "absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors",
            "hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300",
          )}
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </div>
  );
}
