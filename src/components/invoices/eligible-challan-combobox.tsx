"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { listInvoiceEligibleChallans } from "@/lib/actions/invoices/list-invoice-eligible-challans";
import { cn } from "@/lib/utils";
import type { InvoiceEligibleChallanDTO } from "@/types/invoice";

interface EligibleChallanComboboxProps {
  value: InvoiceEligibleChallanDTO | null;
  onChange: (challan: InvoiceEligibleChallanDTO | null) => void;
  disabled?: boolean;
}

type LoadState = "idle" | "loading" | "ready" | "error";

export function EligibleChallanCombobox({
  value,
  onChange,
  disabled,
}: EligibleChallanComboboxProps) {
  const { t, locale } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<InvoiceEligibleChallanDTO[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");

  const dateFormatter = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
    dateStyle: "medium",
  });

  const loadChallans = useCallback(async (query: string) => {
    setLoadState("loading");
    const response = await listInvoiceEligibleChallans({
      search: query.length > 0 ? query : undefined,
      limit: 20,
    });
    if (response.success) {
      setItems(response.data);
      setLoadState("ready");
    } else {
      setItems([]);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void loadChallans(search);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open, search, loadChallans]);

  useEffect(() => {
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
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open) {
            setLoadState("loading");
          }
          setOpen((current) => !current);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-left text-sm shadow-sm transition-colors hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className={cn(!value && "text-slate-400 dark:text-slate-500")}>
          {value
            ? `${value.challanNo} · ${value.dealerName}`
            : t("invoice.issue.challanPlaceholder")}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-2 dark:border-slate-800">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("invoice.issue.challanSearch")}
                className="w-full rounded-md border border-slate-200/80 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {loadState === "loading" && (
              <li className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-slate-500">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                {t("invoice.issue.challanLoading")}
              </li>
            )}
            {loadState === "error" && (
              <li className="px-4 py-6 text-center text-sm text-rose-600 dark:text-rose-400">
                {t("invoice.issue.challanError")}
              </li>
            )}
            {loadState === "ready" && items.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {t("invoice.issue.challanEmpty")}
              </li>
            )}
            {loadState === "ready" &&
              items.map((challan) => (
                <li key={challan.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value?.id === challan.id}
                    onClick={() => {
                      onChange(challan);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
                      {challan.challanNo}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {challan.orderNo} · {challan.dealerName}
                      {challan.dispatchedAt &&
                        ` · ${dateFormatter.format(new Date(challan.dispatchedAt))}`}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
