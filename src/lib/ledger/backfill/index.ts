/**
 * Ledger Backfill — public surface (PHASE_07E1 discovery + PHASE_07E2 replay).
 *
 * Discovery is read-only. Replay mutates `LedgerEntry` only via
 * `createLedgerEntry` — never touches `Dealer.currentBalance`.
 *
 * @see ADR-032, ADR-033
 */

export { getLedgerBackfillCandidates } from "./ledger-backfill-discovery";

export {
  executeLedgerBackfill,
  getReplayStatus,
  previewLedgerReplay,
  assertDealerDiscoveredForReplay,
  replayDealerLedger,
} from "./ledger-backfill-service";

export {
  executeReplayTransaction,
  getReplayStatusForDealer,
  previewReplayForDealer,
} from "./ledger-backfill-replay";

export { buildReplayReport } from "./ledger-backfill-report";

export {
  LedgerBackfillError,
  LedgerBackfillValidationError,
  LedgerReplayChainCorruptedError,
  LedgerReplayNotEligibleError,
  LedgerReplayParityError,
} from "./ledger-backfill-errors";

export {
  classifyBackfillReason,
  expectedMinimumLedgerEntries,
  hasFinancialDocuments,
  hasMissingLedgerRows,
  hasPostedOpeningBalance,
  requiresBackfill,
  summarizeBackfillCandidates,
  toBackfillCandidate,
} from "./ledger-backfill-validation";

export {
  findAllDealersForBackfillDiscovery,
  gatherDealerBackfillMetrics,
  type BackfillReadClient,
} from "./ledger-backfill-query";

export {
  gatherReplayEvents,
  sortReplayEvents,
  type LedgerReplayEvent,
  type ReplayReadClient,
} from "./ledger-backfill-replay-query";

export type {
  DealerBackfillMetrics,
  LedgerBackfillCandidate,
  LedgerBackfillDiscoveryResult,
  LedgerBackfillDiscoverySummary,
  LedgerBackfillReason,
  LedgerReplayCounters,
  LedgerReplayEligibility,
  LedgerReplayPreview,
  LedgerReplayPreviewEvent,
  LedgerReplayResult,
  LedgerReplayStatus,
} from "./ledger-backfill-types";

export type { LedgerReplayReport } from "./ledger-backfill-report";
