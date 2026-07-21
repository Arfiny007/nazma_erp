"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTerritoryProductSales } from "@/lib/actions/reports/product-sales-territory";
import {
  PRODUCT_SALES_PAGE_SIZES,
  buildProductSalesQuery,
  defaultUrlFilters,
  formatLocalDateOnly,
  mergeProductSalesFilters,
  parseLocalDateOnly,
  parseTerritoryProductSalesFilters,
} from "@/lib/reports/product-sales-territory";
import type { ProductSalesUrlFilters } from "@/lib/reports/product-sales-territory";
import type {
  ProductSalesFilterOptionsDTO,
  ProductSalesFiltersDTO,
  ProductSalesSort,
  ProductSalesViewMode,
  TerritoryProductSalesReportDTO,
} from "@/types/product-sales-territory";

interface ProductSalesPageClientProps {
  initialReport: TerritoryProductSalesReportDTO | null;
  filterOptions: ProductSalesFilterOptionsDTO;
  initialFilters: ProductSalesFiltersDTO;
  initialErrorKey: string | null;
}

function toUrlFilters(state: ProductSalesFiltersDTO): ProductSalesUrlFilters {
  return {
    from: parseLocalDateOnly(state.from),
    to: parseLocalDateOnly(state.to),
    territoryId: state.territoryId,
    productId: state.productId,
    categoryId: state.categoryId,
    productSearch: state.productSearch,
    view: state.view,
    sort: state.sort,
    page: state.page,
    pageSize: state.pageSize as 10 | 25 | 50 | 100,
    limit: state.limit,
  };
}

function toFilterState(filters: ProductSalesUrlFilters): ProductSalesFiltersDTO {
  return {
    from: formatLocalDateOnly(filters.from),
    to: formatLocalDateOnly(filters.to),
    territoryId: filters.territoryId,
    productId: filters.productId,
    categoryId: filters.categoryId,
    productSearch: filters.productSearch,
    view: filters.view,
    sort: filters.sort,
    page: filters.page,
    pageSize: filters.pageSize,
    limit: filters.limit,
  };
}

function formatQuantityDisplay(value: string, locale: string): string {
  const [whole, fraction = "00"] = value.split(".");
  const digits = whole.replace(/\D/g, "") || "0";
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formatted =
    locale === "bn"
      ? grouped.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!)
      : grouped;
  const frac =
    locale === "bn"
      ? fraction.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!)
      : fraction;
  return `${formatted}.${frac}`;
}

export function ProductSalesPageClient({
  initialReport,
  filterOptions,
  initialFilters,
  initialErrorKey,
}: ProductSalesPageClientProps) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlKey = searchParams.toString();
  const filters = useMemo(
    () => toFilterState(parseTerritoryProductSalesFilters(
      Object.fromEntries(searchParams.entries()),
    )),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional urlKey sync
    [urlKey],
  );

  const [searchDraft, setSearchDraft] = useState(initialFilters.productSearch);
  const [draftUrlKey, setDraftUrlKey] = useState(urlKey);
  if (draftUrlKey !== urlKey) {
    setDraftUrlKey(urlKey);
    setSearchDraft(filters.productSearch);
  }

  const [report, setReport] = useState(initialReport);
  const [errorKey, setErrorKey] = useState(initialErrorKey);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipUrlLoadRef = useRef(true);
  const lastLoadedKeyRef = useRef(buildProductSalesQuery(toUrlFilters(initialFilters)));

  const syncUrl = (next: ProductSalesFiltersDTO) => {
    const query = buildProductSalesQuery(toUrlFilters(next));
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const loadReport = async (next: ProductSalesFiltersDTO) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await getTerritoryProductSales(next);
      if (id !== requestId.current) return;
      if (result.success) {
        setReport(result.data);
        setErrorKey(null);
      } else {
        setReport(null);
        setErrorKey(result.error.messageKey);
      }
    } catch {
      if (id !== requestId.current) return;
      setReport(null);
      setErrorKey("productSales.error.generic");
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const key = buildProductSalesQuery(toUrlFilters(filters));
    if (skipUrlLoadRef.current) {
      skipUrlLoadRef.current = false;
      lastLoadedKeyRef.current = key;
      return;
    }
    if (key === lastLoadedKeyRef.current) {
      return;
    }
    lastLoadedKeyRef.current = key;
    startTransition(() => {
      void loadReport(filters);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- URL-driven reload
  }, [urlKey]);

  const patchFilters = (patch: Partial<ProductSalesFiltersDTO>) => {
    const merged = mergeProductSalesFilters(toUrlFilters(filters), {
      ...Object.fromEntries(
        Object.entries(patch).map(([k, v]) => {
          if (k === "from" && typeof v === "string") {
            return [k, parseLocalDateOnly(v)];
          }
          if (k === "to" && typeof v === "string") {
            return [k, parseLocalDateOnly(v)];
          }
          return [k, v];
        }),
      ),
    } as Partial<ProductSalesUrlFilters>);
    syncUrl(toFilterState(merged));
  };

  const onSearchChange = (value: string) => {
    setSearchDraft(value);
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }
    searchTimer.current = setTimeout(() => {
      patchFilters({ productSearch: value, page: 1 });
    }, 300);
  };

  const resetFilters = () => {
    const defaults = defaultUrlFilters();
    syncUrl(toFilterState(defaults));
  };

  const territoryLabel =
    filters.territoryId == null
      ? t("productSales.meta.allTerritories")
      : filterOptions.territories.find((x) => x.id === filters.territoryId)
          ?.name ?? filters.territoryId;

  const diagnostics = report?.diagnostics;
  const showFallback =
    (diagnostics?.currentTerritoryFallbackCount ?? 0) > 0 ||
    (diagnostics?.missingHistoricalTerritoryCount ?? 0) > 0;
  const showAmbiguous =
    (diagnostics?.ambiguousHistoricalOwnershipCount ?? 0) > 0;
  const showExcluded = (diagnostics?.excludedRecordCount ?? 0) > 0;

  const subtotalByTerritory = useMemo(() => {
    const map = new Map(
      (report?.territorySubtotals ?? []).map((s) => [s.territoryId, s]),
    );
    return map;
  }, [report?.territorySubtotals]);

  let lastTerritoryId: string | null = null;

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {t("productSales.title")}
            </h1>
            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:border-slate-700">
              {t("productSales.readOnly")}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("productSales.subtitle")}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500 tabular-nums">
          <div>
            {t("productSales.meta.dateRange")}: {filters.from} → {filters.to}
          </div>
          <div>
            {t("productSales.meta.territoryScope")}: {territoryLabel}
          </div>
          {report?.generatedAt ? (
            <div suppressHydrationWarning>
              {t("productSales.meta.generatedAt")}:{" "}
              {new Date(report.generatedAt).toLocaleString()}
            </div>
          ) : null}
        </div>
      </div>

      <section className="mb-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t("productSales.filters.title")}
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            {t("productSales.filters.from")}
            <input
              type="date"
              value={filters.from}
              onChange={(e) => patchFilters({ from: e.target.value })}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            {t("productSales.filters.to")}
            <input
              type="date"
              value={filters.to}
              onChange={(e) => patchFilters({ to: e.target.value })}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            {t("productSales.filters.territory")}
            <select
              value={filters.territoryId ?? ""}
              onChange={(e) =>
                patchFilters({
                  territoryId: e.target.value || null,
                  page: 1,
                })
              }
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">
                {t("productSales.filters.allTerritories")}
              </option>
              {filterOptions.territories.map((territory) => (
                <option key={territory.id} value={territory.id}>
                  {territory.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            {t("productSales.filters.category")}
            <select
              value={filters.categoryId ?? ""}
              onChange={(e) =>
                patchFilters({
                  categoryId: e.target.value || null,
                  page: 1,
                })
              }
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">
                {t("productSales.filters.allCategories")}
              </option>
              {filterOptions.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            {t("productSales.filters.product")}
            <select
              value={filters.productId ?? ""}
              onChange={(e) =>
                patchFilters({
                  productId: e.target.value || null,
                  page: 1,
                })
              }
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t("productSales.filters.allProducts")}</option>
              {filterOptions.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.code} — {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            {t("productSales.filters.productSearch")}
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            {t("productSales.filters.view")}
            <select
              value={filters.view}
              onChange={(e) =>
                patchFilters({
                  view: e.target.value as ProductSalesViewMode,
                  page: 1,
                })
              }
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="territory-product">
                {t("productSales.filters.view.territoryProduct")}
              </option>
              <option value="product-territory">
                {t("productSales.filters.view.productTerritory")}
              </option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            {t("productSales.filters.sort")}
            <select
              value={filters.sort}
              onChange={(e) =>
                patchFilters({
                  sort: e.target.value as ProductSalesSort,
                  page: 1,
                })
              }
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="quantity-desc">
                {t("productSales.filters.sort.quantityDesc")}
              </option>
              <option value="quantity-asc">
                {t("productSales.filters.sort.quantityAsc")}
              </option>
              <option value="product-asc">
                {t("productSales.filters.sort.productAsc")}
              </option>
              <option value="territory-asc">
                {t("productSales.filters.sort.territoryAsc")}
              </option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            {t("productSales.filters.pageSize")}
            <select
              value={filters.pageSize}
              onChange={(e) =>
                patchFilters({
                  pageSize: Number(e.target.value),
                  page: 1,
                })
              }
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {PRODUCT_SALES_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={resetFilters}
            className="h-8 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
          >
            {t("productSales.filters.reset")}
          </button>
        </div>
      </section>

      {errorKey ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <div className="flex items-center justify-between gap-3">
            <span>{t(errorKey)}</span>
            <button
              type="button"
              className="text-xs font-semibold underline"
              onClick={() => void loadReport(filters)}
            >
              {t("productSales.actions.retry")}
            </button>
          </div>
        </div>
      ) : null}

      {showFallback || showAmbiguous || showExcluded ? (
        <div className="mb-4 space-y-2">
          {showFallback ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              {t("productSales.diagnostics.fallbackWarning")}
            </div>
          ) : null}
          {showAmbiguous ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              {t("productSales.diagnostics.ambiguousWarning")}
            </div>
          ) : null}
          {showExcluded ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              {t("productSales.diagnostics.excludedWarning")}
            </div>
          ) : null}
        </div>
      ) : null}

      {report ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {
              key: "totalQuantity",
              label: t("productSales.summary.totalQuantity"),
              value: formatQuantityDisplay(
                report.summary.totalQuantity,
                locale,
              ),
            },
            {
              key: "products",
              label: t("productSales.summary.productsSold"),
              value: String(report.summary.distinctProducts),
            },
            {
              key: "territories",
              label: t("productSales.summary.territoriesCovered"),
              value: String(report.summary.distinctTerritories),
            },
            {
              key: "invoices",
              label: t("productSales.summary.invoices"),
              value: String(report.summary.invoiceCount),
            },
            {
              key: "dealers",
              label: t("productSales.summary.dealers"),
              value: String(report.summary.dealerCount),
            },
          ].map((card) => (
            <div
              key={card.key}
              className="rounded-xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {card.label}
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {card.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">
                  {t("productSales.columns.sl")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                  {t("productSales.columns.territory")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                  {t("productSales.columns.productCode")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                  {t("productSales.columns.productName")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                  {t("productSales.columns.category")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                  {t("productSales.columns.soldQuantity")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">
                  {t("productSales.columns.invoiceCount")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">
                  {t("productSales.columns.dealerCount")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">
                  {t("productSales.columns.territoryRank")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">
                  {t("productSales.columns.overallRank")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading || isPending ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-8 text-center text-slate-500"
                  >
                    {t("productSales.loading")}
                  </td>
                </tr>
              ) : !report || report.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-8 text-center text-slate-500"
                  >
                    {t("productSales.empty")}
                  </td>
                </tr>
              ) : (
                report.rows.flatMap((row, index) => {
                  const showGroupHeader =
                    filters.view === "territory-product" &&
                    row.territoryId !== lastTerritoryId;
                  lastTerritoryId = row.territoryId;
                  const sl =
                    (report.pagination.page - 1) * report.pagination.pageSize +
                    index +
                    1;
                  const subtotal = subtotalByTerritory.get(row.territoryId);
                  const nodes = [];

                  if (showGroupHeader) {
                    nodes.push(
                      <tr
                        key={`group-${row.territoryId}-${index}`}
                        className="bg-slate-50/80 dark:bg-slate-950/60"
                      >
                        <td
                          colSpan={5}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                        >
                          {row.territoryName}
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                          {subtotal
                            ? formatQuantityDisplay(
                                subtotal.soldQuantity,
                                locale,
                              )
                            : "—"}
                        </td>
                        <td
                          colSpan={4}
                          className="px-3 py-1.5 text-xs text-slate-500"
                        >
                          {t("productSales.subtotal.territory")}
                        </td>
                      </tr>,
                    );
                  }

                  nodes.push(
                    <tr
                      key={`${row.territoryId}-${row.productId}-${index}`}
                      className="border-t border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-3 py-1.5 text-center tabular-nums text-slate-500">
                        {sl}
                      </td>
                      <td className="px-3 py-1.5 text-left text-slate-800 dark:text-slate-100">
                        {row.territoryName}
                      </td>
                      <td className="px-3 py-1.5 text-left font-mono text-xs text-slate-600 dark:text-slate-300">
                        {row.productCode}
                      </td>
                      <td className="px-3 py-1.5 text-left text-slate-800 dark:text-slate-100">
                        {row.productName}
                      </td>
                      <td className="px-3 py-1.5 text-left text-slate-600 dark:text-slate-300">
                        {row.categoryName ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium text-slate-900 dark:text-slate-50">
                        {formatQuantityDisplay(row.soldQuantity, locale)}
                      </td>
                      <td className="px-3 py-1.5 text-center tabular-nums">
                        {row.invoiceCount}
                      </td>
                      <td className="px-3 py-1.5 text-center tabular-nums">
                        {row.dealerCount}
                      </td>
                      <td className="px-3 py-1.5 text-center tabular-nums">
                        {row.territoryRank}
                      </td>
                      <td className="px-3 py-1.5 text-center tabular-nums">
                        {row.overallRank}
                      </td>
                    </tr>,
                  );

                  return nodes;
                })
              )}
            </tbody>
          </table>
        </div>

        {report && report.pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs dark:border-slate-800">
            <button
              type="button"
              disabled={report.pagination.page <= 1}
              onClick={() =>
                patchFilters({ page: Math.max(1, report.pagination.page - 1) })
              }
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-slate-700"
            >
              {t("productSales.pagination.prev")}
            </button>
            <span className="tabular-nums text-slate-500">
              {t("productSales.pagination.page")
                .replace("{page}", String(report.pagination.page))
                .replace(
                  "{totalPages}",
                  String(report.pagination.totalPages),
                )}
            </span>
            <button
              type="button"
              disabled={
                report.pagination.page >= report.pagination.totalPages
              }
              onClick={() =>
                patchFilters({ page: report.pagination.page + 1 })
              }
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-slate-700"
            >
              {t("productSales.pagination.next")}
            </button>
          </div>
        ) : null}
      </section>
    </PageContainer>
  );
}
