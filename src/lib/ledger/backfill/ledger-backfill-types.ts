/**
 * Types for the Historical Ledger Discovery Engine — PHASE_07E1.
 *
 * Read-only discovery surface. Identifies dealers that require historical
 * ledger reconstruction before PHASE_07E backfill executes.
 *
 * @see ADR-032
 */

/** Why a dealer was classified during discovery. */
export type LedgerBackfillReason =
  | "NO_LEDGER"
  | "PARTIAL_LEDGER"
  | "CACHE_DRIFT"
  | "RECONCILED";

/** Per-dealer discovery row returned by `getLedgerBackfillCandidates()`. */
export interface LedgerBackfillCandidate {
  dealerCode: string;
  dealerName: string;
  currentBalance: string;
  ledgerEntryCount: number;
  invoiceCount: number;
  collectionCount: number;
  openingBalanceExists: boolean;
  requiresBackfill: boolean;
  reason: LedgerBackfillReason;
}

/** Full discovery result — every active dealer is evaluated. */
export interface LedgerBackfillDiscoveryResult {
  candidates: LedgerBackfillCandidate[];
  summary: LedgerBackfillDiscoverySummary;
}

export interface LedgerBackfillDiscoverySummary {
  dealerCount: number;
  requiresBackfillCount: number;
  reconciledCount: number;
  noLedgerCount: number;
  partialLedgerCount: number;
  cacheDriftCount: number;
}

/** Raw per-dealer metrics gathered by the read query layer. */
export interface DealerBackfillMetrics {
  dealerCode: string;
  dealerName: string;
  currentBalance: import("@prisma/client").Prisma.Decimal;
  ledgerEntryCount: number;
  ledgerBalance: import("@prisma/client").Prisma.Decimal;
  invoiceCount: number;
  collectionCount: number;
  openingBalanceExists: boolean;
}

// ---------------------------------------------------------------------------
// PHASE_07E2 — Historical Ledger Replay Engine
// ---------------------------------------------------------------------------

/** Result of `replayDealerLedger()` — per-dealer replay outcome. */
export interface LedgerReplayResult {
  dealerCode: string;
  createdEntries: number;
  skippedEntries: number;
  openingBalanceEntries: number;
  invoiceEntries: number;
  collectionEntries: number;
  reversalEntries: number;
  finalLedgerBalance: string;
  dealerBalance: string;
  success: boolean;
}

/** Eligibility status for replay — consumed by preview and status actions. */
export type LedgerReplayEligibility =
  | "ELIGIBLE"
  | "RECONCILED"
  | "CACHE_DRIFT"
  | "CORRUPTED_CHAIN"
  | "INVALID_HISTORY"
  | "DEALER_NOT_FOUND";

/** Per-dealer replay status returned by `getReplayStatus()`. */
export interface LedgerReplayStatus {
  dealerCode: string;
  dealerName: string;
  eligibility: LedgerReplayEligibility;
  reason: LedgerBackfillReason | null;
  currentBalance: string;
  ledgerEntryCount: number;
  invoiceCount: number;
  collectionCount: number;
  openingBalanceExists: boolean;
  pendingEvents: number;
  chainValid: boolean;
}

/** Dry-run preview — no writes. */
export interface LedgerReplayPreview {
  dealerCode: string;
  eligibility: LedgerReplayEligibility;
  reason: LedgerBackfillReason | null;
  pendingEvents: number;
  projectedEntries: LedgerReplayPreviewEvent[];
  projectedFinalBalance: string;
  dealerBalance: string;
  parityMatch: boolean;
}

export interface LedgerReplayPreviewEvent {
  eventType: LedgerReplayEventType;
  referenceNo: string;
  transactionDate: string;
  postingKey: string;
  alreadyExists: boolean;
}

/** Internal replay event kinds — strict phase ordering. */
export type LedgerReplayEventType =
  | "OpeningBalance"
  | "Invoice"
  | "Collection"
  | "Reversal";

/** Counters accumulated during replay. */
export interface LedgerReplayCounters {
  createdEntries: number;
  skippedEntries: number;
  openingBalanceEntries: number;
  invoiceEntries: number;
  collectionEntries: number;
  reversalEntries: number;
}

export function emptyReplayCounters(): LedgerReplayCounters {
  return {
    createdEntries: 0,
    skippedEntries: 0,
    openingBalanceEntries: 0,
    invoiceEntries: 0,
    collectionEntries: 0,
    reversalEntries: 0,
  };
}
