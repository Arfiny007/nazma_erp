"use client";

import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { listDealers } from "@/lib/actions/dealers/list-dealers";
import { cn } from "@/lib/utils";
import type { DealerDTO } from "@/types/dealer";

interface DealerComboboxProps {
  value: DealerDTO | null;
  onChange: (dealer: DealerDTO | null) => void;
  disabled?: boolean;
  hasError?: boolean;
  /** When true an explicit "clear" affordance is offered (e.g. list filter). */
  allowClear?: boolean;
  /** Only return active dealers (orders may only be placed for active dealers). */
  activeOnly?: boolean;
  id?: string;
}

/**
 * Accessible, searchable dealer selector backed by the `listDealers` action.
 * Keyboard friendly: the trigger toggles the popover, Escape closes it, and the
 * search input is auto-focused on open.
 */
export function DealerCombobox({
  value,
  onChange,
  disabled,
  hasError,
  allowClear,
  activeOnly,
  id,
}: DealerComboboxProps) {
  const { t } = useLanguage();
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<DealerDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;

    const handle = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        const response = await listDealers({
          page: 1,
          pageSize: 20,
          search: search.length > 0 ? search : undefined,
          ...(activeOnly ? { isActive: true } : {}),
          sortBy: "companyName",
          sortOrder: "asc",
        });
        if (cancelled) {
          return;
        }
        setResults(response.success ? response.data.items : []);
        setLoading(false);
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, search, activeOnly]);

  const handleSelect = (dealer: DealerDTO) => {
    onChange(dealer);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-950",
          hasError
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-600"
            : "border-slate-300 focus:border-slate-400 focus:ring-slate-900/10 dark:border-slate-700 dark:focus:border-slate-600 dark:focus:ring-white/10",
        )}
      >
        {value ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
              {value.dealerCode}
            </span>
            <span className="truncate text-slate-900 dark:text-slate-100">
              {value.companyName}
            </span>
          </span>
        ) : (
          <span className="truncate text-slate-400 dark:text-slate-500">
            {t("order.form.dealer.placeholder")}
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1">
          {allowClear && value && (
            <span
              role="button"
              tabIndex={0}
              aria-label={t("order.search.clear")}
              onClick={(event) => {
                event.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange(null);
                }
              }}
              className="rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X aria-hidden="true" className="size-3.5" />
            </span>
          )}
          <ChevronsUpDown
            aria-hidden="true"
            className="size-4 text-slate-400 dark:text-slate-500"
          />
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="relative border-b border-slate-100 p-2 dark:border-slate-800">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("order.form.dealer.search")}
              className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <ul id={listboxId} role="listbox" className="max-h-64 overflow-auto py-1">
            {loading ? (
              <li className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                {t("order.form.dealer.loading")}
              </li>
            ) : results.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {t("order.form.dealer.empty")}
              </li>
            ) : (
              results.map((dealer) => {
                const selected = dealer.dealerCode === value?.dealerCode;
                return (
                  <li key={dealer.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => handleSelect(dealer)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60",
                        selected && "bg-slate-50 dark:bg-slate-800/60",
                      )}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                          {dealer.companyName}
                        </span>
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          {dealer.dealerCode}
                        </span>
                      </span>
                      {selected && (
                        <Check
                          aria-hidden="true"
                          className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
