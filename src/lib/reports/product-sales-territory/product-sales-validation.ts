import type { TerritoryScope } from "@/lib/rbac/territory";
import { territoryIdMatchesScope } from "@/lib/rbac/territory/territory-rules";
import { startOfDay, startOfMonth } from "@/lib/dashboard/dashboard-validation";

import {
  EmptyTerritoryScopeError,
  ProductSalesError,
  TerritoryOutOfScopeError,
} from "./product-sales-errors";
import {
  DEFAULT_PRODUCT_SALES_PAGE_SIZE,
  DEFAULT_TOP_PRODUCTS_LIMIT,
  PRODUCT_SALES_PAGE_SIZES,
  type ProductSalesFilterParams,
  type ProductSalesPageSize,
  type ProductSalesSort,
  type ProductSalesUrlFilters,
  type ProductSalesViewMode,
} from "./product-sales-types";

/**
 * Filter / scope validation for Territory Product Sales — PHASE_12B / ADR-061.
 *
 * URL search parameters are the canonical report state. Screen actions and
 * dashboard chart actions must share this parser/normalizer.
 */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseLocalDateOnly(value: string): Date {
  const match = DATE_ONLY_RE.exec(value.trim());
  if (!match) {
    throw new ProductSalesError("INVALID_DATE_RANGE", "Invalid date values");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new ProductSalesError("INVALID_DATE_RANGE", "Invalid date values");
  }
  return startOfDay(date);
}

export function formatLocalDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfDayAfter(date: Date): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + 1);
  return next;
}

export function defaultReportDateRange(now: Date = new Date()): {
  from: Date;
  to: Date;
} {
  return { from: startOfMonth(now), to: startOfDay(now) };
}

export function assertValidDateRange(from: Date, to: Date): void {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ProductSalesError("INVALID_DATE_RANGE", "Invalid date values");
  }
  if (startOfDay(from).getTime() > startOfDay(to).getTime()) {
    throw new ProductSalesError(
      "INVALID_DATE_RANGE",
      "from date must be on or before to date",
    );
  }
}

export function assertValidPagination(
  page: number,
  pageSize: number,
): asserts pageSize is ProductSalesPageSize {
  if (!Number.isInteger(page) || page < 1) {
    throw new ProductSalesError("INVALID_PAGINATION", "page must be >= 1");
  }
  if (
    !PRODUCT_SALES_PAGE_SIZES.includes(pageSize as ProductSalesPageSize)
  ) {
    throw new ProductSalesError(
      "INVALID_PAGINATION",
      `pageSize must be one of ${PRODUCT_SALES_PAGE_SIZES.join(", ")}`,
    );
  }
}

export function assertScopedReportAccess(scope: TerritoryScope): void {
  if (scope.mode === "NONE") {
    throw new EmptyTerritoryScopeError();
  }
  if (scope.mode === "TERRITORIES" && scope.territoryIds.length === 0) {
    throw new EmptyTerritoryScopeError();
  }
}

export function assertTerritoryInScope(
  scope: TerritoryScope,
  territoryId: string | null | undefined,
): void {
  if (!territoryId) {
    return;
  }
  if (!territoryIdMatchesScope(scope, territoryId)) {
    throw new TerritoryOutOfScopeError();
  }
}

export function toExclusiveDateBounds(
  from: Date,
  to: Date,
): { fromInclusive: Date; toExclusive: Date } {
  return {
    fromInclusive: startOfDay(from),
    toExclusive: startOfDayAfter(to),
  };
}

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseOptionalUuid(value: string | undefined): string | null {
  if (!value || value.trim() === "" || value === "all") {
    return null;
  }
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(value.trim())) {
    throw new ProductSalesError("VALIDATION_ERROR", "Invalid id filter");
  }
  return value.trim();
}

function parseView(value: string | undefined): ProductSalesViewMode {
  if (value === "product-territory") {
    return "product-territory";
  }
  return "territory-product";
}

function parseSort(value: string | undefined): ProductSalesSort {
  switch (value) {
    case "quantity-asc":
    case "product-asc":
    case "territory-asc":
      return value;
    default:
      return "quantity-desc";
  }
}

function parsePageSize(value: string | undefined): ProductSalesPageSize {
  const n = value ? Number(value) : DEFAULT_PRODUCT_SALES_PAGE_SIZE;
  if (PRODUCT_SALES_PAGE_SIZES.includes(n as ProductSalesPageSize)) {
    return n as ProductSalesPageSize;
  }
  return DEFAULT_PRODUCT_SALES_PAGE_SIZE;
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  max?: number,
): number {
  if (!value) {
    return fallback;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    return fallback;
  }
  if (max !== undefined && n > max) {
    return max;
  }
  return n;
}

/**
 * Canonical URL → filter parser for report + dashboard chart.
 */
export function parseTerritoryProductSalesFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ProductSalesUrlFilters {
  const defaults = defaultReportDateRange();
  const fromRaw = firstParam(searchParams.from);
  const toRaw = firstParam(searchParams.to);

  const from = fromRaw ? parseLocalDateOnly(fromRaw) : defaults.from;
  const to = toRaw ? parseLocalDateOnly(toRaw) : defaults.to;
  assertValidDateRange(from, to);

  const page = parsePositiveInt(firstParam(searchParams.page), 1);
  const pageSize = parsePageSize(firstParam(searchParams.pageSize));
  assertValidPagination(page, pageSize);

  return {
    from,
    to,
    territoryId: parseOptionalUuid(firstParam(searchParams.territoryId)),
    productId: parseOptionalUuid(firstParam(searchParams.productId)),
    categoryId: parseOptionalUuid(firstParam(searchParams.categoryId)),
    productSearch: (firstParam(searchParams.productSearch) ?? "").trim(),
    view: parseView(firstParam(searchParams.view)),
    sort: parseSort(firstParam(searchParams.sort)),
    page,
    pageSize,
    limit: parsePositiveInt(
      firstParam(searchParams.limit),
      DEFAULT_TOP_PRODUCTS_LIMIT,
      50,
    ),
  };
}

export function normalizeFilters(
  params: ProductSalesFilterParams,
): ProductSalesUrlFilters {
  const defaults = defaultReportDateRange();

  let from: Date;
  let to: Date;
  if (params.from instanceof Date) {
    from = startOfDay(params.from);
  } else if (typeof params.from === "string" && params.from.trim()) {
    from = parseLocalDateOnly(params.from);
  } else {
    from = defaults.from;
  }

  if (params.to instanceof Date) {
    to = startOfDay(params.to);
  } else if (typeof params.to === "string" && params.to.trim()) {
    to = parseLocalDateOnly(params.to);
  } else {
    to = defaults.to;
  }

  assertValidDateRange(from, to);

  const page = params.page && params.page >= 1 ? Math.floor(params.page) : 1;
  const pageSize =
    params.pageSize &&
    PRODUCT_SALES_PAGE_SIZES.includes(params.pageSize as ProductSalesPageSize)
      ? (params.pageSize as ProductSalesPageSize)
      : DEFAULT_PRODUCT_SALES_PAGE_SIZE;
  assertValidPagination(page, pageSize);

  return {
    from,
    to,
    territoryId: params.territoryId ?? null,
    productId: params.productId ?? null,
    categoryId: params.categoryId ?? null,
    productSearch: (params.productSearch ?? "").trim(),
    view: params.view ?? "territory-product",
    sort: params.sort ?? "quantity-desc",
    page,
    pageSize,
    limit:
      params.limit && params.limit >= 1
        ? Math.min(50, Math.floor(params.limit))
        : DEFAULT_TOP_PRODUCTS_LIMIT,
  };
}

export function defaultUrlFilters(
  now: Date = new Date(),
): ProductSalesUrlFilters {
  const range = defaultReportDateRange(now);
  return {
    from: range.from,
    to: range.to,
    territoryId: null,
    productId: null,
    categoryId: null,
    productSearch: "",
    view: "territory-product",
    sort: "quantity-desc",
    page: 1,
    pageSize: DEFAULT_PRODUCT_SALES_PAGE_SIZE,
    limit: DEFAULT_TOP_PRODUCTS_LIMIT,
  };
}

export function mergeProductSalesFilters(
  current: ProductSalesUrlFilters,
  patch: Partial<ProductSalesUrlFilters>,
): ProductSalesUrlFilters {
  const next: ProductSalesUrlFilters = {
    ...current,
    ...patch,
  };

  // Territory / product / category / search / sort / view changes reset page.
  if (
    patch.territoryId !== undefined ||
    patch.productId !== undefined ||
    patch.categoryId !== undefined ||
    patch.productSearch !== undefined ||
    patch.sort !== undefined ||
    patch.view !== undefined ||
    patch.from !== undefined ||
    patch.to !== undefined ||
    patch.pageSize !== undefined
  ) {
    if (patch.page === undefined) {
      next.page = 1;
    }
  }

  assertValidDateRange(next.from, next.to);
  assertValidPagination(next.page, next.pageSize);
  return next;
}

export function buildProductSalesQuery(
  filters: ProductSalesUrlFilters,
): string {
  const params = new URLSearchParams();
  params.set("from", formatLocalDateOnly(filters.from));
  params.set("to", formatLocalDateOnly(filters.to));
  if (filters.territoryId) {
    params.set("territoryId", filters.territoryId);
  }
  if (filters.productId) {
    params.set("productId", filters.productId);
  }
  if (filters.categoryId) {
    params.set("categoryId", filters.categoryId);
  }
  if (filters.productSearch) {
    params.set("productSearch", filters.productSearch);
  }
  if (filters.view !== "territory-product") {
    params.set("view", filters.view);
  }
  if (filters.sort !== "quantity-desc") {
    params.set("sort", filters.sort);
  }
  if (filters.page !== 1) {
    params.set("page", String(filters.page));
  }
  if (filters.pageSize !== DEFAULT_PRODUCT_SALES_PAGE_SIZE) {
    params.set("pageSize", String(filters.pageSize));
  }
  return params.toString();
}
