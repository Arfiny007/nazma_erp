import type { TerritoryScope } from "@/lib/rbac/territory";
import { territoryIdMatchesScope } from "@/lib/rbac/territory/territory-rules";
import { startOfDay, startOfMonth } from "@/lib/dashboard/dashboard-validation";

import {
  EmptyTerritoryScopeError,
  SrOutOfScopeError,
  SrPerformanceError,
  TerritoryOutOfScopeError,
} from "./sr-performance-errors";
import {
  SR_PERFORMANCE_PAGE_SIZES,
  type SrPerformanceFilterParams,
  type SrPerformancePageSize,
  type SrPerformancePrintMode,
  type SrPerformanceUrlFilters,
} from "./sr-performance-types";

/**
 * Filter / scope validation for SR Performance — PHASE_12A.1 / ADR-060.
 *
 * URL search parameters are the canonical report state. Screen actions and
 * print actions must share this parser/normalizer.
 */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a date-only `YYYY-MM-DD` string as local calendar midnight.
 * Avoids browser/host timezone shifts from `new Date("YYYY-MM-DD")` (UTC).
 */
export function parseLocalDateOnly(value: string): Date {
  const match = DATE_ONLY_RE.exec(value.trim());
  if (!match) {
    throw new SrPerformanceError("INVALID_DATE_RANGE", "Invalid date values");
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
    throw new SrPerformanceError("INVALID_DATE_RANGE", "Invalid date values");
  }
  return startOfDay(date);
}

/** Serialize a Date to local `YYYY-MM-DD` (never UTC via toISOString). */
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

/** Default report window: current calendar month (inclusive UI dates). */
export function defaultReportDateRange(now: Date = new Date()): {
  from: Date;
  to: Date;
} {
  const from = startOfMonth(now);
  const to = startOfDay(now);
  return { from, to };
}

export function assertValidDateRange(from: Date, to: Date): void {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new SrPerformanceError("INVALID_DATE_RANGE", "Invalid date values");
  }
  if (startOfDay(from).getTime() > startOfDay(to).getTime()) {
    throw new SrPerformanceError(
      "INVALID_DATE_RANGE",
      "from date must be on or before to date",
    );
  }
}

export function assertValidPagination(
  page: number,
  pageSize: number,
): asserts pageSize is SrPerformancePageSize {
  if (!Number.isInteger(page) || page < 1) {
    throw new SrPerformanceError("INVALID_PAGINATION", "page must be >= 1");
  }
  if (
    !SR_PERFORMANCE_PAGE_SIZES.includes(pageSize as SrPerformancePageSize)
  ) {
    throw new SrPerformanceError(
      "INVALID_PAGINATION",
      `pageSize must be one of ${SR_PERFORMANCE_PAGE_SIZES.join(", ")}`,
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
    throw new TerritoryOutOfScopeError(territoryId);
  }
}

export function assertSrInScope(
  allowedSrIds: ReadonlySet<string>,
  srId: string | null | undefined,
): void {
  if (!srId) {
    return;
  }
  if (!allowedSrIds.has(srId)) {
    throw new SrOutOfScopeError(srId);
  }
}

/**
 * Soft-resolve an SR id against allowed scope.
 * Invalid selections are cleared (not thrown) so territory changes stay deterministic.
 */
export function resolveSrIdInScope(
  allowedSrIds: ReadonlySet<string>,
  srId: string | null | undefined,
): string | null {
  if (!srId) {
    return null;
  }
  return allowedSrIds.has(srId) ? srId : null;
}

function pickSearchParam(
  value: string | string[] | undefined | null,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function coercePageSize(raw: string | undefined): SrPerformancePageSize {
  const value = Number(raw ?? "25") || 25;
  if ((SR_PERFORMANCE_PAGE_SIZES as readonly number[]).includes(value)) {
    return value as SrPerformancePageSize;
  }
  return 25;
}

/**
 * Canonical URL → filter parser for screen + print routes.
 * Accepts Next.js `searchParams` records or URLSearchParams-like maps.
 */
export function parseSrPerformanceFilters(
  searchParams:
    | Record<string, string | string[] | undefined>
    | URLSearchParams
    | ReadonlyURLSearchParamsLike,
  now: Date = new Date(),
): SrPerformanceUrlFilters {
  const get = (key: string): string | undefined => {
    if (typeof (searchParams as URLSearchParams).get === "function") {
      return (
        (searchParams as URLSearchParams).get(key) ?? undefined
      );
    }
    return pickSearchParam(
      (searchParams as Record<string, string | string[] | undefined>)[key],
    );
  };

  const defaults = defaultReportDateRange(now);
  const fromRaw = get("from");
  const toRaw = get("to");
  const from = fromRaw
    ? parseLocalDateOnly(fromRaw)
    : startOfDay(defaults.from);
  const to = toRaw ? parseLocalDateOnly(toRaw) : startOfDay(defaults.to);
  assertValidDateRange(from, to);

  const page = Math.max(1, Number(get("page") ?? "1") || 1);
  const pageSize = coercePageSize(get("pageSize"));
  assertValidPagination(page, pageSize);

  const modeRaw = get("mode");
  const mode: SrPerformancePrintMode | null =
    modeRaw === "individual" || modeRaw === "overview" ? modeRaw : null;

  return {
    from,
    to,
    territoryId: get("territoryId") || null,
    srId: get("srId") || null,
    srSearch: (get("srSearch") ?? "").trim(),
    partySearch: (get("partySearch") ?? "").trim(),
    page,
    pageSize,
    mode,
  };
}

/** Merge patch onto current URL filters without dropping unspecified keys. */
export function mergeSrPerformanceFilters(
  current: SrPerformanceUrlFilters,
  patch: Partial<SrPerformanceUrlFilters>,
): SrPerformanceUrlFilters {
  return {
    from: patch.from ?? current.from,
    to: patch.to ?? current.to,
    territoryId:
      patch.territoryId !== undefined ? patch.territoryId : current.territoryId,
    srId: patch.srId !== undefined ? patch.srId : current.srId,
    srSearch: patch.srSearch !== undefined ? patch.srSearch : current.srSearch,
    partySearch:
      patch.partySearch !== undefined ? patch.partySearch : current.partySearch,
    page: patch.page ?? current.page,
    pageSize: patch.pageSize ?? current.pageSize,
    mode: patch.mode !== undefined ? patch.mode : current.mode,
  };
}

/** Build query string from URL filters (omits empty optional params). */
export function buildSrPerformanceQuery(
  filters: SrPerformanceUrlFilters,
  options?: { includeMode?: boolean },
): string {
  const params = new URLSearchParams();
  params.set("from", formatLocalDateOnly(filters.from));
  params.set("to", formatLocalDateOnly(filters.to));
  if (filters.territoryId) params.set("territoryId", filters.territoryId);
  if (filters.srId) params.set("srId", filters.srId);
  if (filters.srSearch) params.set("srSearch", filters.srSearch);
  if (filters.partySearch) params.set("partySearch", filters.partySearch);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.pageSize !== 25) params.set("pageSize", String(filters.pageSize));
  if (options?.includeMode && filters.mode) {
    params.set("mode", filters.mode);
  }
  return params.toString();
}

export function defaultUrlFilters(now: Date = new Date()): SrPerformanceUrlFilters {
  const { from, to } = defaultReportDateRange(now);
  return {
    from,
    to,
    territoryId: null,
    srId: null,
    srSearch: "",
    partySearch: "",
    page: 1,
    pageSize: 25,
    mode: null,
  };
}

export function normalizeFilters(
  input: Partial<SrPerformanceFilterParams>,
  now: Date = new Date(),
): {
  from: Date;
  to: Date;
  territoryId: string | null;
  srId: string | null;
  srSearch: string;
  partySearch: string;
  page: number;
  pageSize: SrPerformancePageSize;
  mode: SrPerformancePrintMode | null;
} {
  const defaults = defaultReportDateRange(now);

  let from: Date;
  let to: Date;
  if (input.from instanceof Date) {
    from = startOfDay(input.from);
  } else if (typeof input.from === "string") {
    from = parseLocalDateOnly(input.from);
  } else {
    from = startOfDay(defaults.from);
  }

  if (input.to instanceof Date) {
    to = startOfDay(input.to);
  } else if (typeof input.to === "string") {
    to = parseLocalDateOnly(input.to);
  } else {
    to = startOfDay(defaults.to);
  }

  assertValidDateRange(from, to);

  const page = input.page ?? 1;
  const pageSize = (input.pageSize ?? 25) as SrPerformancePageSize;
  assertValidPagination(page, pageSize);

  return {
    from,
    to,
    territoryId: input.territoryId ?? null,
    srId: input.srId ?? null,
    srSearch: input.srSearch?.trim() ?? "",
    partySearch: input.partySearch?.trim() ?? "",
    page,
    pageSize,
    mode: input.mode ?? null,
  };
}

/** Database filter bounds for an inclusive UI date range. */
export function toExclusiveDateBounds(from: Date, to: Date): {
  fromInclusive: Date;
  toExclusive: Date;
} {
  return {
    fromInclusive: startOfDay(from),
    toExclusive: startOfDayAfter(to),
  };
}

/** Minimal URLSearchParams-compatible shape (Next.js ReadonlyURLSearchParams). */
interface ReadonlyURLSearchParamsLike {
  get(name: string): string | null;
}
