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
  Eye,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ChallanEmptyState } from "@/components/delivery-challans/challan-empty-state";
import { ChallanStatusBadge, DELIVERY_CHALLAN_STATUSES } from "@/components/delivery-challans/challan-status-badge";
import { DealerCombobox } from "@/components/orders/dealer-combobox";
import { ProductSearch } from "@/components/products/product-search";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { listDeliveryChallans } from "@/lib/actions/delivery-challans/list-delivery-challans";
import { cn } from "@/lib/utils";
import {
  DELIVERY_CHALLAN_SORT_FIELDS,
  type DeliveryChallanSortField,
  type DeliveryChallanStatus,
  type DeliveryChallanSummaryDTO,
  type PaginatedResult,
  type SortOrder,
} from "@/types/delivery-challan";
import type { DealerDTO } from "@/types/dealer";

const PAGE_SIZE = 20;
const COLUMN_COUNT = 9;

type FetchStatus = "loading" | "success" | "error";

function isSortField(value: string): value is DeliveryChallanSortField {
  return (DELIVERY_CHALLAN_SORT_FIELDS as readonly string[]).includes(value);
}

const columnHelper = createColumnHelper<DeliveryChallanSummaryDTO>();

export function ChallanTable() {
  const { t, locale } = useLanguage();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeliveryChallanStatus | "">("");
  const [dealerFilter, setDealerFilter] = useState<DealerDTO | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<DeliveryChallanSortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [result, setResult] = useState<PaginatedResult<DeliveryChallanSummaryDTO> | null>(null);
  const [status, setStatus] = useState<FetchStatus>("loading");
  const [reloadToken, setReloadToken] = useState(0);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [locale],
  );

  const formatDate = useCallback(
    (value: string | null) =>
      value ? dateFormatter.format(new Date(value)) : t("challan.notDispatched"),
    [dateFormatter, t],
  );

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    void (async () => {
      const response = await listDeliveryChallans({
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
      columnHelper.accessor("challanNo", {
        id: "challanNo",
        header: () => t("challan.column.challanNo"),
        enableSorting: true,
        cell: (info) => (
          <Link
            href={`/delivery-challans/${info.row.original.id}`}
            className="font-mono text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("orderNo", {
        id: "orderNo",
        header: () => t("challan.column.orderNo"),
        enableSorting: false,
        cell: (info) => (
          <Link
            href={`/orders/${info.row.original.orderId}`}
            className="font-mono text-xs text-slate-600 hover:underline dark:text-slate-400"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("dealerCode", {
        id: "dealerCode",
        header: () => t("challan.column.dealerCode"),
        enableSorting: false,
        cell: (info) => (
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("dealerName", {
        id: "dealerName",
        header: () => t("challan.column.dealerName"),
        enableSorting: false,
        cell: (info) => (
          <span className="truncate font-medium text-slate-900 dark:text-slate-100">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: () => t("challan.column.status"),
        enableSorting: true,
        cell: (info) => <ChallanStatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor("createdAt", {
        id: "createdAt",
        header: () => t("challan.column.createdDate"),
        enableSorting: true,
        cell: (info) => (
          <span className="whitespace-nowrap text-slate-600 dark:text-slate-300">
            {formatDate(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("dispatchedAt", {
        id: "dispatchedAt",
        header: () => t("challan.column.dispatchedDate"),
        enableSorting: true,
        cell: (info) => (
          <span className="whitespace-nowrap text-slate-600 dark:text-slate-300">
            {formatDate(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.createdByName ?? t("order.unknownUser"), {
        id: "createdBy",
        header: () => t("challan.column.createdBy"),
        enableSorting: false,
        cell: (info) => (
          <span className="truncate text-slate-600 dark:text-slate-300">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => t("challan.column.actions"),
        cell: (info) => (
          <Link
            href={`/delivery-challans/${info.row.original.id}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <Eye aria-hidden="true" className="size-3.5" />
            {t("challan.actions.view")}
          </Link>
        ),
      }),
    ],
    [t, formatDate],
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

  if (isInitialLoading) {
    return <TableSkeleton rows={8} columns={COLUMN_COUNT} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1">
          <ProductSearch value={search} onChange={handleSearchChange} />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as DeliveryChallanStatus | "");
              setPage(1);
            }}
            className={cn(filterControl, "min-w-[140px]")}
            aria-label={t("challan.filters.status")}
          >
            <option value="">{t("challan.filters.allStatuses")}</option>
            {DELIVERY_CHALLAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`challan.status.${s}`)}
              </option>
            ))}
          </select>
          <div className="min-w-[200px]">
            <DealerCombobox
              value={dealerFilter}
              onChange={(dealer) => {
                setDealerFilter(dealer);
                setPage(1);
              }}
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            className={filterControl}
            aria-label={t("challan.filters.dateFrom")}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            className={filterControl}
            aria-label={t("challan.filters.dateTo")}
          />
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <X aria-hidden="true" className="size-3.5" />
              {t("challan.filters.clear")}
            </button>
          )}
        </div>
      </div>

      {status === "error" && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/60 dark:bg-rose-950/40"
        >
          <div className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300">
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
            <span>{t("challan.error.loadFailed")}</span>
          </div>
          <button
            type="button"
            onClick={() => setReloadToken((token) => token + 1)}
            className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
          >
            {t("challan.error.retry")}
          </button>
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition-opacity dark:border-slate-800 dark:bg-slate-900",
          isRefreshing && "opacity-60",
        )}
      >
        {result && result.items.length === 0 ? (
          <ChallanEmptyState filtersActive={filtersActive} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="bg-slate-50/80 dark:bg-slate-800/40">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                      >
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: <ChevronUp aria-hidden="true" className="size-3.5" />,
                              desc: <ChevronDown aria-hidden="true" className="size-3.5" />,
                            }[header.column.getIsSorted() as string] ?? (
                              <ChevronsUpDown aria-hidden="true" className="size-3.5 opacity-40" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("challan.pagination.showing")}{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            {t("challan.pagination.of")}{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">{total}</span>{" "}
            {t("challan.pagination.challans")}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              {t("challan.pagination.previous")}
            </button>
            <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
              {t("challan.pagination.page")} {page} {t("challan.pagination.of")} {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {t("challan.pagination.next")}
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
