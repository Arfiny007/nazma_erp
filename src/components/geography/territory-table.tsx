"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AlertTriangle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { searchTerritories } from "@/lib/actions/geography/search-territories";
import { cn } from "@/lib/utils";
import type { PaginatedResult, TerritoryDTO } from "@/types/geography";

const PAGE_SIZE = 20;
const COLUMN_COUNT = 5;

type FetchStatus = "idle" | "loading" | "success" | "error";

const columnHelper = createColumnHelper<TerritoryDTO>();

export function TerritoryTable() {
  const { t, locale } = useLanguage();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResult<TerritoryDTO> | null>(null);
  const [status, setStatus] = useState<FetchStatus>("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function fetchData(): Promise<void> {
      setStatus("loading");

      const response = await searchTerritories({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
      });

      if (cancelled) {
        return;
      }

      if (!response.success) {
        setStatus("error");
        setResult(null);
        return;
      }

      setResult(response.data);
      setStatus("success");
    }

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, reloadToken]);

  const displayName = useCallback(
    (en: string, bn: string | null) => {
      if (locale === "bn" && bn) {
        return bn;
      }
      return en;
    },
    [locale],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        id: "name",
        header: () => t("geography.column.territory"),
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-50">
              {displayName(row.original.name, row.original.nameBn)}
            </p>
            <p className="font-mono text-xs text-slate-500">{row.original.code}</p>
          </div>
        ),
      }),
      columnHelper.accessor("districtName", {
        id: "district",
        header: () => t("geography.column.district"),
        cell: ({ row }) => (
          <span className="text-slate-700 dark:text-slate-200">
            {row.original.districtName}
          </span>
        ),
      }),
      columnHelper.accessor("divisionName", {
        id: "division",
        header: () => t("geography.column.division"),
        cell: ({ row }) => (
          <span className="text-slate-700 dark:text-slate-200">
            {row.original.divisionName}
          </span>
        ),
      }),
      columnHelper.accessor("isActive", {
        id: "status",
        header: () => t("geography.column.status"),
        cell: ({ row }) => (
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
              row.original.isActive
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
            )}
          >
            {row.original.isActive
              ? t("geography.status.active")
              : t("geography.status.inactive")}
          </span>
        ),
      }),
      columnHelper.accessor("sortOrder", {
        id: "sortOrder",
        header: () => t("geography.column.sortOrder"),
        cell: ({ row }) => (
          <span className="tabular-nums text-slate-600 dark:text-slate-300">
            {row.original.sortOrder}
          </span>
        ),
      }),
    ],
    [displayName, t],
  );

  const table = useReactTable({
    data: result?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (status === "loading" && !result) {
    return <TableSkeleton rows={8} columns={COLUMN_COUNT} />;
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("geography.territories.searchPlaceholder")}
          className="w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-slate-500"
        />
      </div>

      {status === "error" && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div>
            <p>{t("geography.page.loadError")}</p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className="mt-1 font-medium underline"
            >
              {t("geography.error.retry")}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMN_COUNT}
                    className="px-4 py-12 text-center text-sm text-slate-500"
                  >
                    {t("geography.territories.empty")}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {result && result.pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="text-sm text-slate-500">
              {t("geography.pagination.showing")}{" "}
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
                {(result.page - 1) * result.pageSize + 1}–
                {Math.min(result.page * result.pageSize, result.total)}
              </span>{" "}
              {t("geography.pagination.of")}{" "}
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
                {result.total}
              </span>{" "}
              {t("geography.pagination.territories")}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={result.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
                aria-label={t("geography.pagination.previous")}
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </button>
              <span className="px-2 text-sm tabular-nums text-slate-600 dark:text-slate-300">
                {result.page} {t("geography.pagination.page")} {result.pageCount}
              </span>
              <button
                type="button"
                disabled={result.page >= result.pageCount}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
                aria-label={t("geography.pagination.next")}
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
