"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OrderStatus } from "@prisma/client";

import { DealerCombobox } from "@/components/orders/dealer-combobox";
import { OrderEmptyState } from "@/components/orders/order-empty-state";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { ProductSearch } from "@/components/products/product-search";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { listOrders } from "@/lib/actions/orders/list-orders";
import { cn } from "@/lib/utils";
import {
  ORDER_SORT_FIELDS,
  type OrderSortField,
  type OrderSummaryDTO,
  type PaginatedResult,
  type SortOrder,
} from "@/types/order";
import type { DealerDTO } from "@/types/dealer";

const PAGE_SIZE = 20;
const COLUMN_COUNT = 10;

const FILTERABLE_STATUSES: OrderStatus[] = [
  OrderStatus.Draft,
  OrderStatus.Pending_Approval,
  OrderStatus.Approved,
  OrderStatus.Rejected,
  OrderStatus.Cancelled,
];

type FetchStatus = "loading" | "success" | "error";

function isSortField(value: string): value is OrderSortField {
  return (ORDER_SORT_FIELDS as readonly string[]).includes(value);
}

const columnHelper = createColumnHelper<OrderSummaryDTO>();

export function OrderTable() {
  const { t, locale } = useLanguage();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [dealerFilter, setDealerFilter] = useState<DealerDTO | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<OrderSortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [result, setResult] = useState<PaginatedResult<OrderSummaryDTO> | null>(null);
  const [status, setStatus] = useState<FetchStatus>("loading");
  const [reloadToken, setReloadToken] = useState(0);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
        style: "currency",
        currency: "BDT",
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [locale],
  );

  const formatMoney = useCallback(
    (value: string) => currencyFormatter.format(Number(value)),
    [currencyFormatter],
  );
  const formatDate = useCallback(
    (value: string) => dateFormatter.format(new Date(value)),
    [dateFormatter],
  );

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    void (async () => {
      const response = await listOrders({
        page,
        pageSize: PAGE_SIZE,
        search: search.length > 0 ? search : undefined,
        status: statusFilter === "" ? undefined : statusFilter,
        dealerCode: dealerFilter?.dealerCode,
        dateFrom: dateFrom === "" ? undefined : dateFrom,
        dateTo: dateTo === "" ? undefined : `${dateTo}T23:59:59.999`,
        sortBy,
        sortOrder,
      });
      if (cancelled) return;
      if (response.success) {
        setResult(response.data);
        setStatus("success");
      } else {
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    page,
    search,
    statusFilter,
    dealerFilter,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
    reloadToken,
  ]);

  const handleSearchChange = useCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, []);

  const sorting = useMemo<SortingState>(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder],
  );

  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const first = next[0];
      if (first && isSortField(first.id)) {
        setSortBy(first.id);
        setSortOrder(first.desc ? "desc" : "asc");
      } else {
        setSortBy("createdAt");
        setSortOrder("desc");
      }
      setPage(1);
    },
    [sorting],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("orderNo", {
        id: "orderNo",
        header: () => t("order.column.orderNo"),
        enableSorting: true,
        cell: (info) => (
          <Link
            href={`/orders/${info.row.original.id}`}
            className="font-mono text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("dealerCode", {
        id: "dealerCode",
        header: () => t("order.column.dealerCode"),
        enableSorting: false,
        cell: (info) => (
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("dealerName", {
        id: "dealerName",
        header: () => t("order.column.dealerName"),
        enableSorting: false,
        cell: (info) => (
          <span className="truncate font-medium text-slate-900 dark:text-slate-100">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.projectName ?? t("order.noProject"), {
        id: "project",
        header: () => t("order.column.project"),
        enableSorting: false,
        cell: (info) => (
          <span className="truncate text-slate-600 dark:text-slate-300">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: () => t("order.column.status"),
        enableSorting: true,
        cell: (info) => <OrderStatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor("subtotal", {
        id: "subtotal",
        header: () => t("order.column.subtotal"),
        enableSorting: false,
        cell: (info) => (
          <span className="tabular-nums text-slate-700 dark:text-slate-300">
            {formatMoney(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("discount", {
        id: "discount",
        header: () => t("order.column.discount"),
        enableSorting: false,
        cell: (info) => (
          <span className="tabular-nums text-slate-700 dark:text-slate-300">
            {formatMoney(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("grandTotal", {
        id: "grandTotal",
        header: () => t("order.column.grandTotal"),
        enableSorting: true,
        cell: (info) => (
          <span className="tabular-nums font-medium text-slate-900 dark:text-slate-100">
            {formatMoney(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.createdByName ?? t("order.unknownUser"), {
        id: "createdBy",
        header: () => t("order.column.createdBy"),
        enableSorting: false,
        cell: (info) => (
          <span className="truncate text-slate-600 dark:text-slate-300">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("createdAt", {
        id: "createdAt",
        header: () => t("order.column.createdDate"),
        enableSorting: true,
        cell: (info) => (
          <span className="whitespace-nowrap text-slate-600 dark:text-slate-300">
            {formatDate(info.getValue())}
          </span>
        ),
      }),
    ],
    [t, formatMoney, formatDate],
  );

  const table = useReactTable({
    data: result?.items ?? [],
    columns,
    state: { sorting },
    onSortingChange: handleSortingChange,
    manualSorting: true,
    manualPagination: true,
    pageCount: result?.pageCount ?? 0,
    getCoreRowModel: getCoreRowModel(),
  });

  const numericColumns = useMemo(
    () => new Set(["subtotal", "discount", "grandTotal"]),
    [],
  );

  const isInitialLoading = status === "loading" && result === null;
  const isRefreshing = status === "loading" && result !== null;
  const total = result?.total ?? 0;
  const pageCount = result?.pageCount ?? 0;
  const filtersActive =
    search.length > 0 ||
    statusFilter !== "" ||
    dealerFilter !== null ||
    dateFrom !== "" ||
    dateTo !== "";

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setDealerFilter(null);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const filterControl =
    "rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ProductSearch value={search} onChange={handleSearchChange} />
          {status === "success" && total > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("order.pagination.showing")}{" "}
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
                {rangeStart}–{rangeEnd}
              </span>{" "}
              {t("order.pagination.of")}{" "}
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
                {total}
              </span>{" "}
              {t("order.pagination.orders")}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            aria-label={t("order.filters.status")}
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as OrderStatus | "");
              setPage(1);
            }}
            className={cn(filterControl, "cursor-pointer appearance-none")}
          >
            <option value="">{t("order.filters.allStatuses")}</option>
            {FILTERABLE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`order.status.${value}`)}
              </option>
            ))}
          </select>

          <DealerCombobox
            value={dealerFilter}
            onChange={(dealer) => {
              setDealerFilter(dealer);
              setPage(1);
            }}
            allowClear
          />

          <input
            type="date"
            aria-label={t("order.filters.dateFrom")}
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            className={cn(filterControl, "w-full")}
          />
          <input
            type="date"
            aria-label={t("order.filters.dateTo")}
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            className={cn(filterControl, "w-full")}
          />
        </div>

        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X aria-hidden="true" className="size-3.5" />
            {t("order.filters.clear")}
          </button>
        )}
      </div>

      {isInitialLoading && <TableSkeleton rows={8} columns={COLUMN_COUNT} />}

      {status === "error" && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/50 px-6 py-16 text-center dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/60">
            <AlertTriangle aria-hidden="true" className="size-5 text-rose-500 dark:text-rose-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {t("order.error.title")}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {t("order.error.description")}
          </p>
          <button
            type="button"
            onClick={() => {
              setStatus("loading");
              setReloadToken((token) => token + 1);
            }}
            className="mt-6 inline-flex items-center rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {t("order.error.retry")}
          </button>
        </div>
      )}

      {status !== "error" && !isInitialLoading && total === 0 && (
        <OrderEmptyState filtersActive={filtersActive} />
      )}

      {status !== "error" && !isInitialLoading && total > 0 && (
        <>
          <div
            className={cn(
              "overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition-opacity dark:border-slate-800 dark:bg-slate-900",
              isRefreshing && "opacity-60",
            )}
            aria-busy={isRefreshing}
          >
            <div className="max-h-[calc(100vh-22rem)] overflow-auto">
              <table className="w-full min-w-[1080px] border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr
                      key={headerGroup.id}
                      className="border-b border-slate-200/80 bg-slate-50/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
                    >
                      {headerGroup.headers.map((header) => {
                        const canSort = header.column.getCanSort();
                        const sortDir = header.column.getIsSorted();
                        const isNumeric = numericColumns.has(header.column.id);
                        return (
                          <th
                            key={header.id}
                            scope="col"
                            className={cn(
                              "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400",
                              isNumeric ? "text-right" : "text-left",
                            )}
                          >
                            {canSort ? (
                              <button
                                type="button"
                                onClick={header.column.getToggleSortingHandler()}
                                className={cn(
                                  "group inline-flex items-center gap-1 rounded transition-colors hover:text-slate-900 dark:hover:text-slate-200",
                                  isNumeric && "flex-row-reverse",
                                )}
                              >
                                <span>
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                                </span>
                                {sortDir === "asc" ? (
                                  <ChevronUp aria-hidden="true" className="size-3.5 text-slate-700 dark:text-slate-300" />
                                ) : sortDir === "desc" ? (
                                  <ChevronDown aria-hidden="true" className="size-3.5 text-slate-700 dark:text-slate-300" />
                                ) : (
                                  <ChevronsUpDown aria-hidden="true" className="size-3.5 text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400" />
                                )}
                              </button>
                            ) : (
                              flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      {row.getVisibleCells().map((cell) => {
                        const isNumeric = numericColumns.has(cell.column.id);
                        return (
                          <td
                            key={cell.id}
                            className={cn(
                              "px-4 py-3 align-middle",
                              isNumeric ? "text-right" : "text-left",
                            )}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("order.pagination.page")}{" "}
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
                {page}
              </span>{" "}
              {t("order.pagination.of")}{" "}
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
                {pageCount}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || isRefreshing}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors",
                  "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
                  "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                {t("order.pagination.previous")}
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={page >= pageCount || isRefreshing}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors",
                  "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
                  "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
              >
                {t("order.pagination.next")}
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
