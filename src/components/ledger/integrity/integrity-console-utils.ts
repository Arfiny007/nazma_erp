import type { FinancialIntegrityScanRecord } from "@/lib/ledger/monitor";
import type {
  DealerReconciliationResult,
  DealerReconciliationStatus,
} from "@/lib/ledger/reconciliation";

/**
 * Presentation helpers for the Financial Integrity Console — PHASE_07E5.
 * Pure functions only — no financial calculations.
 */

export type OverallHealthStatus = "healthy" | "issues" | "unknown";

export type IntegrityDealerStatusFilter = DealerReconciliationStatus | "ALL";

export interface IntegrityDealerFilters {
  status: IntegrityDealerStatusFilter;
  search: string;
  /** Future-ready — not sent to backend in this phase. */
  fromDate: string;
  /** Future-ready — not sent to backend in this phase. */
  toDate: string;
}

export interface IntegrityScanHistoryFilters {
  /** Future-ready — client-side only on persisted `startedAt`. */
  fromDate: string;
  /** Future-ready — client-side only on persisted `startedAt`. */
  toDate: string;
}

export const INTEGRITY_SCAN_HISTORY_LIMIT = 50;

export const DEFAULT_INTEGRITY_DEALER_FILTERS: IntegrityDealerFilters = {
  status: "ALL",
  search: "",
  fromDate: "",
  toDate: "",
};

export const DEFAULT_INTEGRITY_SCAN_FILTERS: IntegrityScanHistoryFilters = {
  fromDate: "",
  toDate: "",
};

type ScanHealthInput = Pick<
  FinancialIntegrityScanRecord,
  "driftedDealers" | "missingLedgerDealers" | "corruptedDealers" | "status"
>;

/** GREEN when no drift, missing ledger, or corruption on a completed scan. */
export function deriveOverallHealthStatus(
  scan: ScanHealthInput | null,
): OverallHealthStatus {
  if (!scan) {
    return "unknown";
  }
  if (scan.status === "Failed") {
    return "issues";
  }
  if (
    scan.driftedDealers === 0 &&
    scan.missingLedgerDealers === 0 &&
    scan.corruptedDealers === 0
  ) {
    return "healthy";
  }
  return "issues";
}

export function isHealthyScan(scan: ScanHealthInput): boolean {
  return deriveOverallHealthStatus(scan) === "healthy";
}

export function formatIntegrityDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(2)}s`;
}

export function integrityDealerFiltersActive(
  filters: IntegrityDealerFilters,
): boolean {
  return (
    filters.status !== "ALL" ||
    filters.search.trim().length > 0 ||
    filters.fromDate.length > 0 ||
    filters.toDate.length > 0
  );
}

export function filterIntegrityDealers(
  dealers: DealerReconciliationResult[],
  filters: IntegrityDealerFilters,
): DealerReconciliationResult[] {
  let result = dealers;

  if (filters.status !== "ALL") {
    result = result.filter((dealer) => dealer.status === filters.status);
  }

  const query = filters.search.trim().toLowerCase();
  if (query.length > 0) {
    result = result.filter(
      (dealer) =>
        dealer.dealerCode.toLowerCase().includes(query) ||
        dealer.dealerName.toLowerCase().includes(query),
    );
  }

  return result;
}

function parseFilterDate(value: string): Date | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function filterIntegrityScans(
  scans: FinancialIntegrityScanRecord[],
  filters: IntegrityScanHistoryFilters,
): FinancialIntegrityScanRecord[] {
  const from = parseFilterDate(filters.fromDate);
  const to = parseFilterDate(filters.toDate);

  if (!from && !to) {
    return scans;
  }

  return scans.filter((scan) => {
    const startedAt = new Date(scan.startedAt);
    if (from && startedAt < from) {
      return false;
    }
    if (to) {
      const endOfDay = new Date(to);
      endOfDay.setHours(23, 59, 59, 999);
      if (startedAt > endOfDay) {
        return false;
      }
    }
    return true;
  });
}

export function countDealersByStatus(
  dealers: DealerReconciliationResult[],
): Record<DealerReconciliationStatus, number> {
  const counts: Record<DealerReconciliationStatus, number> = {
    CONSISTENT: 0,
    DRIFT: 0,
    MISSING_LEDGER: 0,
    CORRUPTED_CHAIN: 0,
  };

  for (const dealer of dealers) {
    counts[dealer.status] += 1;
  }

  return counts;
}
