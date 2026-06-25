"use client";

import { AlertTriangle, Check, ChevronsUpDown, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { OrderStatus } from "@prisma/client";

import { useLanguage } from "@/contexts/LanguageContext";
import { listOrders } from "@/lib/actions/orders/list-orders";
import { cn } from "@/lib/utils";
import type { OrderSummaryDTO } from "@/types/order";

type LoadState = "idle" | "loading" | "ready" | "error";

interface EligibleOrderComboboxProps {
  value: OrderSummaryDTO | null;
  onChange: (order: OrderSummaryDTO | null) => void;
  disabled?: boolean;
}

const ELIGIBLE_STATUSES = [OrderStatus.Approved, OrderStatus.Partially_Delivered];

export function EligibleOrderCombobox({
  value,
  onChange,
  disabled = false,
}: EligibleOrderComboboxProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<OrderSummaryDTO[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const containerRef = useRef<HTMLDivElement>(null);

  const loadOrders = useCallback(async () => {
    setLoadState("loading");
    try {
      const [approved, partial] = await Promise.all(
        ELIGIBLE_STATUSES.map((status) =>
          listOrders({ page: 1, pageSize: 50, status, sortBy: "createdAt", sortOrder: "desc" }),
        ),
      );

      if (!approved.success || !partial.success) {
        setLoadState("error");
        return;
      }

      const merged = new Map<string, OrderSummaryDTO>();
      for (const item of [...approved.data.items, ...partial.data.items]) {
        merged.set(item.id, item);
      }
      setOrders(
        Array.from(merged.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, []);

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

  const filtered = orders.filter((order) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      order.orderNo.toLowerCase().includes(q) ||
      order.dealerCode.toLowerCase().includes(q) ||
      order.dealerName.toLowerCase().includes(q)
    );
  });

  const handleOpen = () => {
    if (disabled) return;
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && (loadState === "idle" || loadState === "error")) {
      void loadOrders();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left text-sm shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {value ? (
          <span className="min-w-0 truncate">
            <span className="font-mono font-medium text-blue-700 dark:text-blue-400">
              {value.orderNo}
            </span>
            <span className="mx-1.5 text-slate-400">·</span>
            <span className="text-slate-700 dark:text-slate-300">{value.dealerName}</span>
          </span>
        ) : (
          <span className="text-slate-400">{t("challan.form.order.placeholder")}</span>
        )}
        <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-2 dark:border-slate-800">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("challan.form.order.search")}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              autoFocus
            />
          </div>

          <ul
            role="listbox"
            className="max-h-60 overflow-y-auto py-1"
            aria-label={t("challan.form.order.label")}
          >
            {loadState === "loading" && (
              <li className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-slate-500">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                {t("challan.form.order.loading")}
              </li>
            )}

            {loadState === "error" && (
              <li className="px-3 py-4">
                <div
                  role="alert"
                  className="flex flex-col items-center gap-2 text-center text-sm text-rose-600 dark:text-rose-400"
                >
                  <AlertTriangle aria-hidden="true" className="size-4" />
                  <span>{t("challan.form.order.error")}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoadState("idle");
                      void loadOrders();
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
                  >
                    <RefreshCw aria-hidden="true" className="size-3" />
                    {t("challan.form.order.retry")}
                  </button>
                </div>
              </li>
            )}

            {loadState === "ready" && filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-slate-500">
                {t("challan.form.order.empty")}
              </li>
            )}

            {loadState === "ready" &&
              filtered.map((order) => (
                <li key={order.id} role="option" aria-selected={value?.id === order.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(order);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800",
                      value?.id === order.id && "bg-slate-50 dark:bg-slate-800/60",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-mono font-medium text-slate-900 dark:text-slate-100">
                        {order.orderNo}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {order.dealerCode} · {order.dealerName}
                      </p>
                    </div>
                    {value?.id === order.id && (
                      <Check aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
                    )}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
