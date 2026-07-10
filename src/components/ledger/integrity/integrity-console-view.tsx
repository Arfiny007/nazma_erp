"use client";

import { useMemo, useState } from "react";

import type { FinancialIntegrityScanRecord } from "@/lib/ledger/monitor";
import type { ReconciliationReport } from "@/lib/ledger/reconciliation";

import { IntegrityConsoleEmptyState } from "./integrity-console-empty-state";
import { IntegrityConsoleHeader } from "./integrity-console-header";
import { IntegrityDealerFiltersBar } from "./integrity-dealer-filters";
import { IntegrityDealerTable } from "./integrity-dealer-table";
import {
  DEFAULT_INTEGRITY_DEALER_FILTERS,
  DEFAULT_INTEGRITY_SCAN_FILTERS,
  type IntegrityDealerFilters,
} from "./integrity-console-utils";
import { IntegrityScanControls } from "./integrity-scan-controls";
import { IntegrityScanHistoryTable } from "./integrity-scan-history-table";
import { IntegritySummaryCards } from "./integrity-summary-cards";

interface IntegrityConsoleViewProps {
  latestScan: FinancialIntegrityScanRecord | null;
  scanHistory: FinancialIntegrityScanRecord[];
  reconciliationReport: ReconciliationReport;
}

export function IntegrityConsoleView({
  latestScan,
  scanHistory,
  reconciliationReport,
}: IntegrityConsoleViewProps) {
  const [dealerFilters, setDealerFilters] = useState<IntegrityDealerFilters>(
    DEFAULT_INTEGRITY_DEALER_FILTERS,
  );
  const [selectedScanId, setSelectedScanId] = useState<string | null>(
    latestScan?.scanId ?? null,
  );

  const selectedScan = useMemo(
    () => scanHistory.find((scan) => scan.scanId === selectedScanId) ?? latestScan,
    [latestScan, scanHistory, selectedScanId],
  );

  return (
    <div className="space-y-6">
      <IntegrityConsoleHeader latestScan={latestScan} />

      {latestScan ? (
        <IntegritySummaryCards scan={latestScan} />
      ) : (
        <IntegrityConsoleEmptyState />
      )}

      <IntegrityScanControls />

      <IntegrityScanHistoryTable
        filters={DEFAULT_INTEGRITY_SCAN_FILTERS}
        onSelectScan={setSelectedScanId}
        scans={scanHistory}
        selectedScanId={selectedScanId}
      />

      {selectedScan ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {selectedScan.scanId}
          </span>
          {" · "}
          {selectedScan.consistentDealers} consistent · {selectedScan.driftedDealers}{" "}
          drifted · {selectedScan.missingLedgerDealers} missing ·{" "}
          {selectedScan.corruptedDealers} corrupted
        </div>
      ) : null}

      <IntegrityDealerFiltersBar
        filters={dealerFilters}
        onChange={setDealerFilters}
      />

      <IntegrityDealerTable
        dealers={reconciliationReport.dealers}
        filters={dealerFilters}
      />
    </div>
  );
}
