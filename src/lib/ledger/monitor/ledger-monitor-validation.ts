import type { ReconciliationSummary } from "@/lib/ledger/reconciliation";

import type {
  FinancialIntegrityScanRecord,
  FinancialIntegrityScanResult,
  FinancialIntegrityScanStatus,
  ListIntegrityScansParams,
} from "./ledger-monitor-types";

/**
 * Validation helpers for PHASE_07E4 integrity monitor.
 *
 * @see ADR-035
 */

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

export function normalizeListIntegrityScansParams(
  params: ListIntegrityScansParams = {},
): { limit: number } {
  const raw = params.limit ?? DEFAULT_LIST_LIMIT;
  if (!Number.isFinite(raw) || raw < 1) {
    return { limit: DEFAULT_LIST_LIMIT };
  }
  return { limit: Math.min(Math.floor(raw), MAX_LIST_LIMIT) };
}

export function deriveScanStatus(
  summary: ReconciliationSummary,
): FinancialIntegrityScanStatus {
  void summary;
  return "Completed";
}

export function toFinancialIntegrityScanResult(row: {
  id: string;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  totalDealers: number;
  consistentDealers: number;
  driftedDealers: number;
  missingLedgerDealers: number;
  corruptedDealers: number;
}): FinancialIntegrityScanResult {
  return {
    scanId: row.id,
    totalDealers: row.totalDealers,
    consistentDealers: row.consistentDealers,
    driftedDealers: row.driftedDealers,
    missingLedgerDealers: row.missingLedgerDealers,
    corruptedDealers: row.corruptedDealers,
    startedAt: row.startedAt.toISOString(),
    completedAt: (row.completedAt ?? row.startedAt).toISOString(),
    durationMs: row.durationMs ?? 0,
  };
}

export function toFinancialIntegrityScanRecord(row: {
  id: string;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  totalDealers: number;
  consistentDealers: number;
  driftedDealers: number;
  missingLedgerDealers: number;
  corruptedDealers: number;
  status: FinancialIntegrityScanStatus;
  createdAt: Date;
  updatedAt: Date;
}): FinancialIntegrityScanRecord {
  return {
    ...toFinancialIntegrityScanResult(row),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
