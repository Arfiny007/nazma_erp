import { prisma } from "@/lib/prisma";

import {
  LedgerReplayChainCorruptedError,
  LedgerReplayNotEligibleError,
  LedgerReplayParityError,
} from "./ledger-backfill-errors";
import { getLedgerBackfillCandidates } from "./ledger-backfill-discovery";
import {
  executeReplayTransaction,
  getReplayStatusForDealer,
  previewReplayForDealer,
  replayDealerLedger,
} from "./ledger-backfill-replay";
import { buildReplayReport } from "./ledger-backfill-report";
import type {
  LedgerReplayPreview,
  LedgerReplayResult,
  LedgerReplayStatus,
} from "./ledger-backfill-types";

/**
 * Orchestration layer for historical ledger replay — PHASE_07E2.
 *
 * Consumes PHASE_07E1 discovery results. Wraps replay in transactions with
 * dealer row lock. Never duplicates classification logic.
 *
 * @see ADR-033
 */

export interface ExecuteLedgerBackfillInput {
  dealerCode: string;
  createdById?: string | null;
}

export interface ExecuteLedgerBackfillOutput {
  result: LedgerReplayResult;
  report: ReturnType<typeof buildReplayReport>;
}

/**
 * Execute historical ledger replay for one dealer inside a transaction.
 */
export async function executeLedgerBackfill(
  input: ExecuteLedgerBackfillInput,
): Promise<ExecuteLedgerBackfillOutput> {
  const { dealerCode, createdById } = input;

  const result = await prisma.$transaction(async (tx) =>
    executeReplayTransaction(tx, dealerCode, createdById),
  );

  return {
    result,
    report: buildReplayReport(result),
  };
}

/**
 * Dry-run preview — no writes.
 */
export async function previewLedgerReplay(
  dealerCode: string,
): Promise<LedgerReplayPreview> {
  return previewReplayForDealer(prisma, dealerCode);
}

/**
 * Replay eligibility and pending-event status for one dealer.
 */
export async function getReplayStatus(
  dealerCode: string,
): Promise<LedgerReplayStatus> {
  return getReplayStatusForDealer(prisma, dealerCode);
}

/**
 * Verify dealer appears in discovery with eligible reason before replay.
 */
export async function assertDealerDiscoveredForReplay(
  dealerCode: string,
): Promise<void> {
  const discovery = await getLedgerBackfillCandidates();
  const candidate = discovery.candidates.find(
    (c) => c.dealerCode === dealerCode,
  );

  if (!candidate) {
    throw new LedgerReplayNotEligibleError(
      "DEALER_NOT_FOUND",
      `Dealer ${dealerCode} not found in discovery scan`,
    );
  }

  if (candidate.reason === "RECONCILED") {
    throw new LedgerReplayNotEligibleError(
      "RECONCILED",
      `Dealer ${dealerCode} is already reconciled`,
    );
  }

  if (candidate.reason === "CACHE_DRIFT") {
    throw new LedgerReplayNotEligibleError(
      "CACHE_DRIFT",
      `Dealer ${dealerCode} has cache drift — manual investigation required`,
    );
  }
}

export {
  LedgerReplayChainCorruptedError,
  LedgerReplayNotEligibleError,
  LedgerReplayParityError,
  replayDealerLedger,
};
