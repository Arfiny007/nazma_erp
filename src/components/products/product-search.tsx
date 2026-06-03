"use client";

import { Search, X } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface ProductSearchProps {
  value: string;
  onChange: (next: string) => void;
}

export function ProductSearch({ value, onChange }: ProductSearchProps) {
  const { t } = useLanguage();

  return (
    <div className="relative w-full sm:max-w-xs">
      <label htmlFor="product-search" className="sr-only">
        {t("products.search.label")}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
      />
      <input
        id="product-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("products.search.placeholder")}
        className={cn(
          "w-full rounded-lg border border-slate-200/80 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 shadow-sm placeholder:text-slate-400",
          "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
          "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500",
          "dark:focus:border-blue-400 dark:focus:ring-blue-400",
        )}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("products.search.clear")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </div>
  );
}
