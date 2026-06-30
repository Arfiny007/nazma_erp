"use client";

import { Search, X } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";

interface CollectionSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function CollectionSearch({ value, onChange }: CollectionSearchProps) {
  const { t } = useLanguage();

  return (
    <div className="relative w-full max-w-sm">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("collection.search.placeholder")}
        aria-label={t("collection.search.label")}
        className="w-full rounded-lg border border-slate-200/80 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-600"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("collection.search.clear")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}
