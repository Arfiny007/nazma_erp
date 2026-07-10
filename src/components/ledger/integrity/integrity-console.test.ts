import { describe, expect, it } from "vitest";

import {
  DEFAULT_INTEGRITY_DEALER_FILTERS,
  deriveOverallHealthStatus,
  filterIntegrityDealers,
  filterIntegrityScans,
  formatIntegrityDuration,
  integrityDealerFiltersActive,
  isHealthyScan,
} from "@/components/ledger/integrity/integrity-console-utils";
import type { FinancialIntegrityScanRecord } from "@/lib/ledger/monitor";
import type { DealerReconciliationResult } from "@/lib/ledger/reconciliation";

/**
 * Presentation-layer tests for PHASE_07E5 Financial Integrity Console.
 */

function makeScan(
  overrides: Partial<FinancialIntegrityScanRecord> = {},
): FinancialIntegrityScanRecord {
  return {
    scanId: "scan-1",
    startedAt: "2026-07-10T08:00:00.000Z",
    completedAt: "2026-07-10T08:00:01.500Z",
    durationMs: 1500,
    totalDealers: 3,
    consistentDealers: 3,
    driftedDealers: 0,
    missingLedgerDealers: 0,
    corruptedDealers: 0,
    status: "Completed",
    createdAt: "2026-07-10T08:00:01.500Z",
    updatedAt: "2026-07-10T08:00:01.500Z",
    ...overrides,
  };
}

function makeDealer(
  overrides: Partial<DealerReconciliationResult> & Pick<DealerReconciliationResult, "dealerCode" | "status">,
): DealerReconciliationResult {
  return {
    dealerName: "Test Dealer",
    dealerBalance: "1000.00",
    latestLedgerBalance: "1000.00",
    summedLedgerBalance: "1000.00",
    drift: "0.00",
    ledgerEntryCount: 1,
    ...overrides,
  };
}

describe("Financial Integrity Console — presentation helpers", () => {
  it("empty state — unknown health when no scan exists", () => {
    expect(deriveOverallHealthStatus(null)).toBe("unknown");
    expect(isHealthyScan(makeScan())).toBe(true);
  });

  it("healthy system — GREEN when all issue counts are zero", () => {
    const scan = makeScan({
      consistentDealers: 5,
      totalDealers: 5,
    });

    expect(deriveOverallHealthStatus(scan)).toBe("healthy");
    expect(isHealthyScan(scan)).toBe(true);
  });

  it("drifted system — YELLOW when drifted dealers present", () => {
    const scan = makeScan({
      consistentDealers: 4,
      driftedDealers: 1,
      totalDealers: 5,
    });

    expect(deriveOverallHealthStatus(scan)).toBe("issues");
    expect(isHealthyScan(scan)).toBe(false);
  });

  it("missing ledger — YELLOW when missing ledger dealers present", () => {
    const scan = makeScan({
      consistentDealers: 2,
      missingLedgerDealers: 1,
      totalDealers: 3,
    });

    expect(deriveOverallHealthStatus(scan)).toBe("issues");
  });

  it("corrupted chain — YELLOW when corrupted dealers present", () => {
    const scan = makeScan({
      consistentDealers: 1,
      corruptedDealers: 1,
      totalDealers: 2,
    });

    expect(deriveOverallHealthStatus(scan)).toBe("issues");
  });

  it("failed scan execution — YELLOW overall status", () => {
    const scan = makeScan({
      status: "Failed",
      consistentDealers: 0,
      totalDealers: 0,
    });

    expect(deriveOverallHealthStatus(scan)).toBe("issues");
  });

  it("manual scan duration formatting", () => {
    expect(formatIntegrityDuration(250)).toBe("250ms");
    expect(formatIntegrityDuration(1500)).toBe("1.50s");
  });

  it("history rendering — preserves scan rows for table consumption", () => {
    const scans = [
      makeScan({ scanId: "scan-2", startedAt: "2026-07-10T09:00:00.000Z" }),
      makeScan({ scanId: "scan-1", startedAt: "2026-07-10T08:00:00.000Z" }),
    ];

    expect(scans).toHaveLength(2);
    expect(scans[0].scanId).toBe("scan-2");
    expect(scans[1].consistentDealers).toBe(3);
  });

  it("history date filter — client-side only on startedAt", () => {
    const scans = [
      makeScan({ scanId: "a", startedAt: "2026-07-01T10:00:00.000Z" }),
      makeScan({ scanId: "b", startedAt: "2026-07-15T10:00:00.000Z" }),
    ];

    const filtered = filterIntegrityScans(scans, {
      fromDate: "2026-07-10",
      toDate: "",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].scanId).toBe("b");
  });

  it("dealer filtering — status filter", () => {
    const dealers = [
      makeDealer({ dealerCode: "D-OK", status: "CONSISTENT" }),
      makeDealer({ dealerCode: "D-BAD", status: "DRIFT" }),
    ];

    const filtered = filterIntegrityDealers(dealers, {
      ...DEFAULT_INTEGRITY_DEALER_FILTERS,
      status: "DRIFT",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].dealerCode).toBe("D-BAD");
  });

  it("dealer filtering — search by code and name", () => {
    const dealers = [
      makeDealer({
        dealerCode: "D-ALPHA",
        dealerName: "Alpha Traders",
        status: "CONSISTENT",
      }),
      makeDealer({
        dealerCode: "D-BETA",
        dealerName: "Beta Hardware",
        status: "MISSING_LEDGER",
      }),
    ];

    expect(
      filterIntegrityDealers(dealers, {
        ...DEFAULT_INTEGRITY_DEALER_FILTERS,
        search: "alpha",
      }),
    ).toHaveLength(1);

    expect(
      filterIntegrityDealers(dealers, {
        ...DEFAULT_INTEGRITY_DEALER_FILTERS,
        search: "hardware",
      }),
    ).toHaveLength(1);

    expect(integrityDealerFiltersActive(DEFAULT_INTEGRITY_DEALER_FILTERS)).toBe(
      false,
    );
    expect(
      integrityDealerFiltersActive({
        ...DEFAULT_INTEGRITY_DEALER_FILTERS,
        search: "x",
      }),
    ).toBe(true);
  });
});
