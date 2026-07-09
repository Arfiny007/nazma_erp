import type { LedgerPostingType } from "@prisma/client";

/**
 * Visual-only row accent helpers for the Dealer Statement table.
 * Never affects amounts, running balance, or query results.
 */

export type StatementRowAccent =
  | "opening"
  | "collection"
  | "reversal"
  | "default";

export function getStatementRowAccent(
  postingType: LedgerPostingType,
  isOpeningBalance: boolean,
): StatementRowAccent {
  if (isOpeningBalance || postingType === "OpeningBalance") {
    return "opening";
  }
  if (postingType === "Collection") {
    return "collection";
  }
  if (postingType === "Reversal") {
    return "reversal";
  }
  return "default";
}

/** Tailwind classes applied to `<tr>` — presentation only. */
export const STATEMENT_ROW_ACCENT_CLASS: Record<StatementRowAccent, string> = {
  opening: "bg-blue-50/60 dark:bg-blue-950/20",
  collection: "bg-emerald-50/40 dark:bg-emerald-950/15",
  reversal: "bg-amber-50/50 dark:bg-amber-950/20",
  default: "",
};

export const STATEMENT_PAGE_SIZE = 50;

/** Quick date presets — set from/to only; no money math. */
export type StatementQuickFilter =
  | "all"
  | "thisMonth"
  | "last30"
  | "thisQuarter"
  | "ytd";

export interface StatementDatePreset {
  fromDate: string;
  toDate: string;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Resolves a quick-filter preset into ISO date strings (yyyy-MM-dd).
 * Pure calendar math — no financial calculations.
 */
export function resolveStatementQuickFilter(
  preset: StatementQuickFilter,
  now: Date = new Date(),
): StatementDatePreset | null {
  if (preset === "all") {
    return null;
  }

  const toDate = toIsoDate(now);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === "last30") {
    start.setDate(start.getDate() - 29);
    return { fromDate: toIsoDate(start), toDate };
  }

  if (preset === "thisMonth") {
    return {
      fromDate: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      toDate,
    };
  }

  if (preset === "thisQuarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return {
      fromDate: toIsoDate(new Date(now.getFullYear(), quarterStartMonth, 1)),
      toDate,
    };
  }

  // ytd
  return {
    fromDate: toIsoDate(new Date(now.getFullYear(), 0, 1)),
    toDate,
  };
}

/**
 * Builds the server-action payload from UI filter state.
 * Future filters (postingType / referenceType / search) are accepted on the
 * UI model but intentionally omitted until the read engine supports them —
 * adding them later requires no layout redesign.
 */
export interface DealerStatementFilterState {
  dealerCode: string;
  fromDate: string;
  toDate: string;
  postingType: string;
  referenceType: string;
  search: string;
  page: number;
  pageSize: number;
}

export interface DealerStatementQueryPayload {
  dealerCode: string;
  fromDate?: string;
  toDate?: string;
  page: number;
  pageSize: number;
}

export function buildDealerStatementQueryPayload(
  filters: DealerStatementFilterState,
): DealerStatementQueryPayload {
  return {
    dealerCode: filters.dealerCode,
    fromDate: filters.fromDate || undefined,
    toDate: filters.toDate || undefined,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export function statementFiltersActive(
  filters: Pick<
    DealerStatementFilterState,
    "fromDate" | "toDate" | "postingType" | "referenceType" | "search"
  >,
): boolean {
  return Boolean(
    filters.fromDate ||
      filters.toDate ||
      filters.postingType ||
      filters.referenceType ||
      filters.search.trim(),
  );
}

export function mapLedgerStatementErrorKey(
  code: string,
  messageKey?: string,
): string {
  if (messageKey && messageKey.startsWith("ledgerStatement.")) {
    return messageKey;
  }
  if (messageKey === "rbac.noAccess") {
    return "ledgerStatement.error.forbidden";
  }

  switch (code) {
    case "DEALER_NOT_FOUND":
      return "ledgerStatement.error.dealerNotFound";
    case "INVALID_DATE_RANGE":
      return "ledgerStatement.error.invalidDateRange";
    case "INVALID_PAGINATION":
      return "ledgerStatement.error.invalidPagination";
    case "FORBIDDEN":
      return "ledgerStatement.error.forbidden";
    case "VALIDATION_ERROR":
      return messageKey ?? "ledgerStatement.error.generic";
    default:
      return "ledgerStatement.error.generic";
  }
}
