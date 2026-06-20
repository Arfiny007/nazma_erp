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
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { ProductEmptyState } from "@/components/products/product-empty-state";
import { ProductSearch } from "@/components/products/product-search";
import { ProductStatusBadge } from "@/components/products/product-status-badge";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { listProducts } from "@/lib/actions/products/list-products";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  PRODUCT_SORT_FIELDS,
  type PaginatedResult,
  type ProductDTO,
  type ProductSortField,
  type SortOrder,
} from "@/types/product";
import type { UserRole } from "@prisma/client";

const PAGE_SIZE = 20;
const COLUMN_COUNT = 7;

type FetchStatus = "idle" | "loading" | "success" | "error";

function isSortField(value: string): value is ProductSortField {
  return (PRODUCT_SORT_FIELDS as readonly string[]).includes(value);
}

const columnHelper = createColumnHelper<ProductDTO>();

export function ProductTable() {
  const { t, locale } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const canEdit = userRole ? hasPermission(userRole, "products:edit") : false;

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<ProductSortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [result, setResult] = useState<PaginatedResult<ProductDTO> | null>(null);
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

  const formatMoney = useCallback(
    (value: string) => currencyFormatter.format(Number(value)),
    [currencyFormatter],
  );

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");

    void (async () => {
      const response = await listProducts({
        page,
        pageSize: PAGE_SIZE,
        search: search.length > 0 ? search : undefined,
        sortBy,
        sortOrder,
      });

      if (cancelled) {
        return;
      }

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
  }, [page, search, sortBy, sortOrder, reloadToken]);

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
      const next =
        typeof updater === "function" ? updater(sorting) : updater;
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
      columnHelper.accessor("modelNumber", {
        id: "modelNumber",
        header: () => t("products.column.modelNumber"),
        enableSorting: true,
        cell: (info) => (
          <span className="font-mono text-xs font-semibold tracking-wide text-blue-700 dark:text-blue-400">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("sku", {
        id: "sku",
        header: () => t("products.column.sku"),
        enableSorting: true,
        cell: (info) => (
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("name", {
        id: "name",
        header: () => t("products.column.name"),
        enableSorting: true,
        cell: (info) => {
          const product = info.row.original;
          return (
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                {product.name}
              </p>
              {product.nameBn && (
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {product.nameBn}
                </p>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor((row) => row.category?.name ?? "—", {
        id: "category",
        header: () => t("products.column.category"),
        enableSorting: false,
        cell: (info) => (
          <span className="truncate text-slate-700 dark:text-slate-300">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("currentPrice", {
        id: "currentPrice",
        header: () => t("products.column.currentPrice"),
        enableSorting: true,
        cell: (info) => (
          <span className="tabular-nums font-medium text-slate-900 dark:text-slate-100">
            {formatMoney(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("isActive", {
        id: "isActive",
        header: () => t("products.column.status"),
        enableSorting: false,
        cell: (info) => <ProductStatusBadge isActive={info.getValue()} />,
      }),
      columnHelper.display({
        id: "actions",
        header: () => null,
        enableSorting: false,
        cell: (info) =>
          canEdit ? (
            <Link
              href={`/products/${info.row.original.id}/edit`}
              aria-label={t("products.actions.editProduct")}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <Pencil aria-hidden="true" className="size-3.5" />
              {t("products.actions.edit")}
            </Link>
          ) : null,
      }),
    ],
    [t, formatMoney, canEdit],
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

  const numericColumns = useMemo(() => new Set(["currentPrice"]), []);

  const isInitialLoading = status === "loading" && result === null;
  const isRefreshing = status === "loading" && result !== null;
  const total = result?.total ?? 0;
  const pageCount = result?.pageCount ?? 0;
  const searchActive = search.length > 0;

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ProductSearch value={search} onChange={handleSearchChange} />
        {status === "success" && total > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("products.pagination.showing")}{" "}
            <span className="font-medium text-slate-700 tabular-nums dark:text-slate-300">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            {t("products.pagination.of")}{" "}
            <span className="font-medium text-slate-700 tabular-nums dark:text-slate-300">
              {total}
            </span>{" "}
            {t("products.pagination.products")}
          </p>
        )}
      </div>

      {isInitialLoading && (
        <TableSkeleton rows={8} columns={COLUMN_COUNT} />
      )}

      {status === "error" && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/50 px-6 py-16 text-center dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/60">
            <AlertTriangle
              aria-hidden="true"
              className="size-5 text-rose-500 dark:text-rose-400"
            />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {t("products.error.title")}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {t("products.error.description")}
          </p>
          <button
            type="button"
            onClick={() => {
              setStatus("loading");
              setReloadToken((token) => token + 1);
            }}
            className="mt-6 inline-flex items-center rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {t("products.error.retry")}
          </button>
        </div>
      )}

      {status !== "error" && !isInitialLoading && total === 0 && (
        <ProductEmptyState searchActive={searchActive} />
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
            <div className="max-h-[calc(100vh-20rem)] overflow-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
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
                                  <ChevronUp
                                    aria-hidden="true"
                                    className="size-3.5 text-slate-700 dark:text-slate-300"
                                  />
                                ) : sortDir === "desc" ? (
                                  <ChevronDown
                                    aria-hidden="true"
                                    className="size-3.5 text-slate-700 dark:text-slate-300"
                                  />
                                ) : (
                                  <ChevronsUpDown
                                    aria-hidden="true"
                                    className="size-3.5 text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400"
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
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
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
              {t("products.pagination.page")}{" "}
              <span className="font-medium text-slate-700 tabular-nums dark:text-slate-300">
                {page}
              </span>{" "}
              {t("products.pagination.of")}{" "}
              <span className="font-medium text-slate-700 tabular-nums dark:text-slate-300">
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
                {t("products.pagination.previous")}
              </button>
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(pageCount, current + 1))
                }
                disabled={page >= pageCount || isRefreshing}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors",
                  "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
                  "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
              >
                {t("products.pagination.next")}
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
