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
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InvoiceStatus } from "@prisma/client";

import { InvoiceEmptyState } from "@/components/invoices/invoice-empty-state";
import { InvoiceFilters } from "@/components/invoices/invoice-filters";
import { InvoiceSearch } from "@/components/invoices/invoice-search";
import { InvoiceSkeleton } from "@/components/invoices/invoice-skeleton";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { listInvoices } from "@/lib/actions/invoices/list-invoices";
import { cn } from "@/lib/utils";
import type { DealerDTO } from "@/types/dealer";
import {
  INVOICE_SORT_FIELDS,
  type InvoiceSortField,
  type InvoiceSummaryDTO,
  type PaginatedResult,
  type SortOrder,
} from "@/types/invoice";

const PAGE_SIZE = 20;

type FetchStatus = "loading" | "success" | "error";

function isSortField(value: string): value is InvoiceSortField {
  return (INVOICE_SORT_FIELDS as readonly string[]).includes(value);
}

const columnHelper = createColumnHelper<InvoiceSummaryDTO>();

export function InvoiceTable() {
  const { t, locale } = useLanguage();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");
  const [dealerFilter, setDealerFilter] = useState<DealerDTO | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<InvoiceSortField>("issueDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [result, setResult] = useState<PaginatedResult<InvoiceSummaryDTO> | null>(null);
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
      const response = await listInvoices({
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
        setSortBy("issueDate");
        setSortOrder("desc");
      }
      setPage(1);
    },
    [sorting],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("invoiceNo", {
        id: "invoiceNo",
        header: () => t("invoice.column.invoiceNo"),
        enableSorting: true,
        cell: (info) => (
          <Link
            href={`/invoices/${info.row.original.id}`}
            className="font-mono text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("dealerCode", {
        id: "dealerCode",
        header: () => t("invoice.column.dealerCode"),
        enableSorting: false,
        cell: (info) => (
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("dealerName", {
        id: "dealerName",
        header: () => t("invoice.column.dealerName"),
        enableSorting: false,
        cell: (info) => (
          <span className="truncate font-medium text-slate-900 dark:text-slate-100">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("orderNo", {
        id: "orderNo",
        header: () => t("invoice.column.orderNo"),
        enableSorting: false,
        cell: (info) => (
          <Link
            href={`/orders/${info.row.original.orderId}`}
            className="font-mono text-xs text-blue-700 hover:underline dark:text-blue-400"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor((row) => row.challanNo ?? "—", {
        id: "challanNo",
        header: () => t("invoice.column.challanNo"),
        enableSorting: false,
        cell: (info) => {
          const row = info.row.original;
          if (!row.challanNo || !row.deliveryChallanId) {
            return <span className="text-slate-400">—</span>;
          }
          return (
            <Link
              href={`/delivery-challans/${row.deliveryChallanId}`}
              className="font-mono text-xs text-blue-700 hover:underline dark:text-blue-400"
            >
              {row.challanNo}
            </Link>
          );
        },
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: () => t("invoice.column.status"),
        enableSorting: true,
        cell: (info) => <InvoiceStatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor("grandTotal", {
        id: "grandTotal",
        header: () => t("invoice.column.grandTotal"),
        enableSorting: true,
        cell: (info) => (
          <span className="tabular-nums font-medium text-slate-900 dark:text-slate-100">
            {formatMoney(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("currentDue", {
        id: "currentDue",
        header: () => t("invoice.column.currentDue"),
        enableSorting: false,
        cell: (info) => (
          <span className="tabular-nums text-slate-700 dark:text-slate-300">
            {formatMoney(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("issueDate", {
        id: "issueDate",
        header: () => t("invoice.column.issueDate"),
        enableSorting: true,
        cell: (info) => (
          <span className="whitespace-nowrap text-slate-600 dark:text-slate-300">
            {formatDate(info.getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => t("invoice.column.actions"),
        cell: (info) => (
          <Link
            href={`/invoices/${info.row.original.id}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
            aria-label={t("invoice.actions.view")}
          >
            <Eye aria-hidden="true" className="size-3.5" />
            {t("invoice.actions.view")}
          </Link>
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
    () => new Set(["grandTotal", "currentDue"]),
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

  if (isInitialLoading) {
    return <InvoiceSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <InvoiceSearch value={search} onChange={handleSearchChange} />
          {status === "success" && total > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("invoice.pagination.showing")}{" "}
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
                {rangeStart}–{rangeEnd}
              </span>{" "}
              {t("invoice.pagination.of")}{" "}
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
                {total}
              </span>{" "}
              {t("invoice.pagination.invoices")}
            </p>
          )}
        </div>

        <InvoiceFilters
          statusFilter={statusFilter}
          dealerFilter={dealerFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onStatusChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          onDealerChange={(dealer) => {
            setDealerFilter(dealer);
            setPage(1);
          }}
          onDateFromChange={(value) => {
            setDateFrom(value);
            setPage(1);
          }}
          onDateToChange={(value) => {
            setDateTo(value);
            setPage(1);
          }}
          onClear={clearFilters}
          filtersActive={filtersActive}
        />
      </div>

      {status === "error" && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-rose-200/80 bg-rose-50/50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400"
        >
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          <span className="flex-1">{t("invoice.error.loadFailed")}</span>
          <button
            type="button"
            onClick={() => setReloadToken((token) => token + 1)}
            className="rounded-md px-2 py-1 text-xs font-semibold underline-offset-2 hover:underline"
          >
            {t("invoice.error.retry")}
          </button>
        </div>
      )}

      {status === "success" && total === 0 ? (
        <InvoiceEmptyState filtersActive={filtersActive} />
      ) : (
        <div
          className={cn(
            "overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900",
            isRefreshing && "opacity-60",
          )}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr
                    key={headerGroup.id}
                    className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60"
                  >
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sorted = header.column.getIsSorted();
                      const isNumeric = numericColumns.has(header.column.id);

                      return (
                        <th
                          key={header.id}
                          scope="col"
                          className={cn(
                            "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400",
                            isNumeric ? "text-right" : "text-left",
                          )}
                        >
                          {canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className={cn(
                                "inline-flex items-center gap-1 transition-colors hover:text-slate-700 dark:hover:text-slate-200",
                                isNumeric && "ml-auto",
                              )}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                              {sorted === "asc" ? (
                                <ChevronUp aria-hidden="true" className="size-3.5" />
                              ) : sorted === "desc" ? (
                                <ChevronDown aria-hidden="true" className="size-3.5" />
                              ) : (
                                <ChevronsUpDown
                                  aria-hidden="true"
                                  className="size-3.5 opacity-40"
                                />
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
                    className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isNumeric = numericColumns.has(cell.column.id);
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "px-4 py-3",
                            isNumeric && "text-right",
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

          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("invoice.pagination.page")}{" "}
                <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
                  {page}
                </span>{" "}
                {t("invoice.pagination.of")}{" "}
                <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
                  {pageCount}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                  {t("invoice.pagination.previous")}
                </button>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t("invoice.pagination.next")}
                  <ChevronRight aria-hidden="true" className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
