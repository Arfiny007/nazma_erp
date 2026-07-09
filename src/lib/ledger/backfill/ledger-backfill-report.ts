import type { LedgerReplayResult } from "./ledger-backfill-types";

/**
 * Human-readable replay report — PHASE_07E2.
 *
 * Presentation-only summary of replay outcomes. No financial calculations.
 *
 * @see ADR-033
 */

export interface LedgerReplayReport {
  dealerCode: string;
  success: boolean;
  summary: string;
  createdEntries: number;
  skippedEntries: number;
  breakdown: {
    openingBalance: number;
    invoices: number;
    collections: number;
    reversals: number;
  };
  finalLedgerBalance: string;
  dealerBalance: string;
  parityMatch: boolean;
}

export function buildReplayReport(result: LedgerReplayResult): LedgerReplayReport {
  const parityMatch = result.finalLedgerBalance === result.dealerBalance;

  const summary = result.success
    ? `Replay completed for ${result.dealerCode}: ${result.createdEntries} entries created, ${result.skippedEntries} skipped.`
    : `Replay failed parity check for ${result.dealerCode}: ledger=${result.finalLedgerBalance}, dealer=${result.dealerBalance}.`;

  return {
    dealerCode: result.dealerCode,
    success: result.success,
    summary,
    createdEntries: result.createdEntries,
    skippedEntries: result.skippedEntries,
    breakdown: {
      openingBalance: result.openingBalanceEntries,
      invoices: result.invoiceEntries,
      collections: result.collectionEntries,
      reversals: result.reversalEntries,
    },
    finalLedgerBalance: result.finalLedgerBalance,
    dealerBalance: result.dealerBalance,
    parityMatch,
  };
}
