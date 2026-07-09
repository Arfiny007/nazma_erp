import { Prisma } from "@prisma/client";

import { lockDealerForFinancialUpdate } from "@/lib/finance/dealer-lock";
import {
  assertLedgerBalanceMatchesCache,
  createLedgerEntry,
  validateDealerLedgerChain,
  type LedgerPostingInput,
} from "@/lib/ledger";
import { buildLedgerPostingKey } from "@/lib/ledger/posting-key";
import { applyPostingToBalance } from "@/lib/ledger/ledger-validation";

import {
  LedgerReplayChainCorruptedError,
  LedgerReplayNotEligibleError,
  LedgerReplayParityError,
} from "./ledger-backfill-errors";
import {
  classifyBackfillReason,
} from "./ledger-backfill-validation";
import {
  findDealerForReplay,
  findExistingPostingKeys,
  gatherReplayEvents,
  type LedgerReplayEvent,
  type ReplayReadClient,
} from "./ledger-backfill-replay-query";
import type {
  LedgerReplayCounters,
  LedgerReplayEligibility,
  LedgerReplayPreview,
  LedgerReplayPreviewEvent,
  LedgerReplayResult,
  LedgerReplayStatus,
} from "./ledger-backfill-types";
import { emptyReplayCounters } from "./ledger-backfill-types";
import { gatherDealerBackfillMetrics } from "./ledger-backfill-query";

/**
 * Historical Ledger Replay Engine — PHASE_07E2.
 *
 * Reconstructs missing `LedgerEntry` rows for eligible dealers by replaying
 * financial documents in strict chronological order. Uses `createLedgerEntry`
 * and `buildLedgerPostingKey` — never duplicates posting logic or mutates
 * `Dealer.currentBalance`.
 *
 * @see ADR-033
 */

const ZERO = new Prisma.Decimal(0);

export interface ReplayDealerLedgerOptions {
  /** When true, simulate replay without persisting ledger rows. */
  dryRun?: boolean;
  /** Actor for `createdById` on new entries. Nullable for system replay. */
  createdById?: string | null;
}

/**
 * Replay historical financial documents into `LedgerEntry` for one dealer.
 *
 * Idempotent — safe to run twice; `postingKey` is the only idempotency guard.
 * Parity is verified after replay; mismatch rolls back the transaction.
 */
export async function replayDealerLedger(
  tx: ReplayReadClient,
  dealerCode: string,
  options: ReplayDealerLedgerOptions = {},
): Promise<LedgerReplayResult> {
  const dealer = await findDealerForReplay(tx, dealerCode);
  if (!dealer) {
    throw new LedgerReplayNotEligibleError(
      "DEALER_NOT_FOUND",
      `Dealer not found: ${dealerCode}`,
    );
  }

  await assertDealerReplayEligible(tx, dealerCode);

  const events = await gatherReplayEvents(tx, dealerCode);
  const counters = emptyReplayCounters();
  let runningBalance = ZERO;

  for (const event of events) {
    const outcome = await processReplayEvent(
      tx,
      dealerCode,
      event,
      runningBalance,
      {
        dryRun: options.dryRun ?? false,
        createdById: options.createdById ?? event.createdById,
      },
    );

    runningBalance = outcome.balance;
    if (outcome.isNew) {
      counters.createdEntries += 1;
      incrementEventCounter(counters, event.eventType);
    } else {
      counters.skippedEntries += 1;
    }
  }

  const finalLedgerBalance = runningBalance;
  const dealerBalance = dealer.currentBalance;

  if (!options.dryRun) {
    assertLedgerBalanceMatchesCache(
      dealerCode,
      finalLedgerBalance,
      dealerBalance,
    );

    if (!finalLedgerBalance.equals(dealerBalance)) {
      throw new LedgerReplayParityError(
        dealerCode,
        finalLedgerBalance.toFixed(2),
        dealerBalance.toFixed(2),
      );
    }
  }

  return {
    dealerCode,
    createdEntries: counters.createdEntries,
    skippedEntries: counters.skippedEntries,
    openingBalanceEntries: counters.openingBalanceEntries,
    invoiceEntries: counters.invoiceEntries,
    collectionEntries: counters.collectionEntries,
    reversalEntries: counters.reversalEntries,
    finalLedgerBalance: finalLedgerBalance.toFixed(2),
    dealerBalance: dealerBalance.toFixed(2),
    success: finalLedgerBalance.equals(dealerBalance),
  };
}

/**
 * Execute replay inside a transaction with dealer row lock.
 */
export async function executeReplayTransaction(
  tx: ReplayReadClient & Prisma.TransactionClient,
  dealerCode: string,
  createdById?: string | null,
): Promise<LedgerReplayResult> {
  await lockDealerForFinancialUpdate(tx, dealerCode);
  return replayDealerLedger(tx, dealerCode, { createdById });
}

/** Build a dry-run preview without writes. */
export async function previewReplayForDealer(
  client: ReplayReadClient,
  dealerCode: string,
): Promise<LedgerReplayPreview> {
  const dealer = await findDealerForReplay(client, dealerCode);
  if (!dealer) {
    return {
      dealerCode,
      eligibility: "DEALER_NOT_FOUND",
      reason: null,
      pendingEvents: 0,
      projectedEntries: [],
      projectedFinalBalance: "0.00",
      dealerBalance: "0.00",
      parityMatch: false,
    };
  }

  const eligibility = await resolveReplayEligibility(client, dealerCode);
  const events = await gatherReplayEvents(client, dealerCode);
  const postingKeys = events.map((e) => e.postingKey);
  const existingKeys = await findExistingPostingKeys(
    client,
    dealerCode,
    postingKeys,
  );

  let runningBalance = ZERO;
  const projectedEntries: LedgerReplayPreviewEvent[] = [];

  for (const event of events) {
    const alreadyExists = existingKeys.has(event.postingKey);
    projectedEntries.push({
      eventType: event.eventType,
      referenceNo: event.referenceNo,
      transactionDate: event.transactionDate.toISOString(),
      postingKey: event.postingKey,
      alreadyExists,
    });

    if (alreadyExists) {
      const existing = await client.ledgerEntry.findUnique({
        where: { postingKey: event.postingKey },
        select: { balance: true },
      });
      if (existing) {
        runningBalance = existing.balance;
      }
    } else {
      runningBalance = applyPostingToBalance(
        runningBalance,
        event.debit,
        event.credit,
      );
    }
  }

  const pendingEvents = projectedEntries.filter((e) => !e.alreadyExists).length;
  const metrics = await gatherDealerBackfillMetrics(client);
  const dealerMetrics = metrics.find((m) => m.dealerCode === dealerCode);
  const reason = dealerMetrics
    ? classifyBackfillReason(dealerMetrics)
    : null;

  return {
    dealerCode,
    eligibility,
    reason,
    pendingEvents,
    projectedEntries,
    projectedFinalBalance: runningBalance.toFixed(2),
    dealerBalance: dealer.currentBalance.toFixed(2),
    parityMatch: runningBalance.equals(dealer.currentBalance),
  };
}

/** Status snapshot for a single dealer. */
export async function getReplayStatusForDealer(
  client: ReplayReadClient,
  dealerCode: string,
): Promise<LedgerReplayStatus> {
  const dealer = await findDealerForReplay(client, dealerCode);
  if (!dealer) {
    return {
      dealerCode,
      dealerName: "",
      eligibility: "DEALER_NOT_FOUND",
      reason: null,
      currentBalance: "0.00",
      ledgerEntryCount: 0,
      invoiceCount: 0,
      collectionCount: 0,
      openingBalanceExists: false,
      pendingEvents: 0,
      chainValid: true,
    };
  }

  const metrics = await gatherDealerBackfillMetrics(client);
  const dealerMetrics = metrics.find((m) => m.dealerCode === dealerCode);
  const reason = dealerMetrics ? classifyBackfillReason(dealerMetrics) : null;
  const eligibility = await resolveReplayEligibility(client, dealerCode);

  const events = await gatherReplayEvents(client, dealerCode);
  const existingKeys = await findExistingPostingKeys(
    client,
    dealerCode,
    events.map((e) => e.postingKey),
  );
  const pendingEvents = events.filter(
    (e) => !existingKeys.has(e.postingKey),
  ).length;

  let chainValid = true;
  if ((dealerMetrics?.ledgerEntryCount ?? 0) > 0) {
    const chain = await validateDealerLedgerChain(client, dealerCode);
    chainValid = chain.isChainValid;
  }

  return {
    dealerCode,
    dealerName: dealer.companyName,
    eligibility,
    reason,
    currentBalance: dealer.currentBalance.toFixed(2),
    ledgerEntryCount: dealerMetrics?.ledgerEntryCount ?? 0,
    invoiceCount: dealerMetrics?.invoiceCount ?? 0,
    collectionCount: dealerMetrics?.collectionCount ?? 0,
    openingBalanceExists: dealerMetrics?.openingBalanceExists ?? false,
    pendingEvents,
    chainValid,
  };
}

async function assertDealerReplayEligible(
  client: ReplayReadClient,
  dealerCode: string,
): Promise<void> {
  const eligibility = await resolveReplayEligibility(client, dealerCode);
  if (eligibility !== "ELIGIBLE") {
    if (eligibility === "CORRUPTED_CHAIN") {
      throw new LedgerReplayChainCorruptedError(dealerCode);
    }
    throw new LedgerReplayNotEligibleError(
      eligibility,
      `Dealer ${dealerCode} is not eligible for replay (${eligibility})`,
    );
  }
}

async function resolveReplayEligibility(
  client: ReplayReadClient,
  dealerCode: string,
): Promise<LedgerReplayEligibility> {
  const dealer = await findDealerForReplay(client, dealerCode);
  if (!dealer) {
    return "DEALER_NOT_FOUND";
  }

  const metrics = await gatherDealerBackfillMetrics(client);
  const dealerMetrics = metrics.find((m) => m.dealerCode === dealerCode);
  if (!dealerMetrics) {
    return "DEALER_NOT_FOUND";
  }

  const reason = classifyBackfillReason(dealerMetrics);
  const events = await gatherReplayEvents(client, dealerCode);
  const existingKeys = await findExistingPostingKeys(
    client,
    dealerCode,
    events.map((e) => e.postingKey),
  );
  const pendingEvents = events.filter(
    (e) => !existingKeys.has(e.postingKey),
  ).length;

  if (dealerMetrics.ledgerEntryCount > 0) {
    const chain = await validateDealerLedgerChain(client, dealerCode);
    if (!chain.isChainValid) {
      return "CORRUPTED_CHAIN";
    }
  }

  if (pendingEvents === 0) {
    if (dealerMetrics.ledgerEntryCount > 0) {
      const chain = await validateDealerLedgerChain(client, dealerCode);
      if (!chain.isChainValid) {
        return "CORRUPTED_CHAIN";
      }
      if (chain.isCacheValid) {
        return "ELIGIBLE";
      }
    }
    if (reason === "CACHE_DRIFT") {
      return "CACHE_DRIFT";
    }
    if (reason === "RECONCILED") {
      return "RECONCILED";
    }
    return "INVALID_HISTORY";
  }

  if (reason === "CACHE_DRIFT") {
    const projected = await projectReplayBalance(client, dealerCode, events);
    if (!projected.equals(dealer.currentBalance)) {
      return "CACHE_DRIFT";
    }
  }

  if (reason === "RECONCILED" && pendingEvents > 0) {
    return "ELIGIBLE";
  }

  if (reason === "NO_LEDGER" || reason === "PARTIAL_LEDGER") {
    return "ELIGIBLE";
  }

  if (pendingEvents > 0) {
    const projected = await projectReplayBalance(client, dealerCode, events);
    if (projected.equals(dealer.currentBalance)) {
      return "ELIGIBLE";
    }
    return "INVALID_HISTORY";
  }

  return "INVALID_HISTORY";
}

async function projectReplayBalance(
  client: ReplayReadClient,
  dealerCode: string,
  events: LedgerReplayEvent[],
): Promise<Prisma.Decimal> {
  let runningBalance = ZERO;

  for (const event of events) {
    const existing = await client.ledgerEntry.findUnique({
      where: { postingKey: event.postingKey },
      select: { balance: true },
    });
    if (existing) {
      runningBalance = existing.balance;
    } else {
      runningBalance = applyPostingToBalance(
        runningBalance,
        event.debit,
        event.credit,
      );
    }
  }

  return runningBalance;
}

interface ProcessReplayOutcome {
  balance: Prisma.Decimal;
  isNew: boolean;
}

async function processReplayEvent(
  tx: ReplayReadClient,
  dealerCode: string,
  event: LedgerReplayEvent,
  previousBalance: Prisma.Decimal,
  options: { dryRun: boolean; createdById: string | null },
): Promise<ProcessReplayOutcome> {
  if (options.dryRun) {
    const existing = await tx.ledgerEntry.findUnique({
      where: { postingKey: event.postingKey },
      select: { balance: true },
    });
    if (existing) {
      return { balance: existing.balance, isNew: false };
    }
    return {
      balance: applyPostingToBalance(previousBalance, event.debit, event.credit),
      isNew: true,
    };
  }

  let reversesEntryId: string | undefined;
  if (event.eventType === "Reversal" && event.reversesCollectionId) {
    const originalKey = buildLedgerPostingKey({
      referenceType: event.referenceType,
      referenceId: event.reversesCollectionId,
      postingType: "Collection",
    });
    const original = await tx.ledgerEntry.findUnique({
      where: { postingKey: originalKey },
      select: { id: true },
    });
    reversesEntryId = original?.id;
  }

  const postingInput: LedgerPostingInput = {
    tx: tx as LedgerPostingInput["tx"],
    dealerCode,
    transactionDate: event.transactionDate,
    referenceType: event.referenceType,
    referenceId: event.referenceId,
    referenceNo: event.referenceNo,
    postingType: event.postingType,
    postingKey: event.postingKey,
    debit: event.debit,
    credit: event.credit,
    previousBalance,
    reversesEntryId,
    createdById: options.createdById,
    remarks: event.remarks,
  };

  const result = await createLedgerEntry(postingInput);
  return { balance: result.balance, isNew: result.isNew };
}

function incrementEventCounter(
  counters: LedgerReplayCounters,
  eventType: LedgerReplayEvent["eventType"],
): void {
  switch (eventType) {
    case "OpeningBalance":
      counters.openingBalanceEntries += 1;
      break;
    case "Invoice":
      counters.invoiceEntries += 1;
      break;
    case "Collection":
      counters.collectionEntries += 1;
      break;
    case "Reversal":
      counters.reversalEntries += 1;
      break;
    default: {
      const _exhaustive: never = eventType;
      void _exhaustive;
    }
  }
}
