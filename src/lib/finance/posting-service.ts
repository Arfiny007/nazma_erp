import { LedgerPostingType, Prisma } from "@prisma/client";

import {
  assertLedgerBalanceMatchesCache,
  buildLedgerPostingKey,
  buildOpeningBalancePosting,
  createLedgerEntry,
  type LedgerPostingInput,
  type LedgerPostingResult,
} from "@/lib/ledger";
import {
  DEALER_BALANCE_UPDATED_ACTION,
  DEALER_BALANCE_DECREASED_ACTION,
  DEALER_OPENING_BALANCE_POSTED_ACTION,
  FINANCIAL_REFERENCE_COLLECTION,
  type OpeningBalancePostingInput,
  type OpeningBalancePostingResult,
  type ReceivableDecreasePostingInput,
  type ReceivableDecreasePostingResult,
  type ReceivablePostingInput,
  type ReceivablePostingResult,
} from "@/lib/finance/types";

/**
 * Financial Posting Service — single boundary for dealer balance mutations
 * AND the sole path into the append-only `LedgerEntry` subledger.
 *
 * All modules that touch dealer receivables (Invoice Engine, Collection Engine,
 * future Credit Note / Debit Note / Journal Entry engines) MUST route through
 * this module. Direct `Dealer.currentBalance` updates from feature code and
 * direct `LedgerEntry` inserts from anywhere OTHER than
 * `createLedgerEntry` (called only from here) are strictly forbidden.
 *
 * Phase history:
 *   - PHASE_05C: balance + audit only (LedgerEntry deferred).
 *   - PHASE_05C2A: atomic `increment`/`decrement`; caller-held dealer row lock;
 *     `previousBalance` from the locked snapshot; balance-drift assertion.
 *   - PHASE_06A2: `postReceivableDecrease` for collection cash receipt.
 *   - PHASE_07A: input contracts extended with optional ledger metadata; the
 *     ledger foundation (`src/lib/ledger`) shipped but not yet wired.
 *   - PHASE_07B (this phase): wires `createLedgerEntry` into each function
 *     body. After the atomic `Dealer.currentBalance` update, the posting
 *     service inserts an immutable `LedgerEntry`, asserts
 *     `LedgerEntry.balance === Dealer.currentBalance`, and finally writes the
 *     audit trail. All work happens inside the caller's transaction; any
 *     failure rolls the entire commit back.
 *
 * @see ADR-024, ADR-025, ADR-026, FINANCIAL_INVARIANTS.md §5 + §18–19
 */

const DEALER_ENTITY_TYPE = "Dealer";
const ZERO = new Prisma.Decimal(0);

export async function postReceivableIncrease(
  input: ReceivablePostingInput,
): Promise<ReceivablePostingResult> {
  const {
    tx,
    dealerCode,
    amount,
    previousBalance,
    userId,
    referenceType,
    referenceId,
    referenceNo,
  } = input;

  if (amount.lessThanOrEqualTo(0)) {
    throw new RangeError("Receivable posting amount must be positive");
  }

  const updated = await tx.dealer.update({
    where: { dealerCode },
    data: { currentBalance: { increment: amount } },
    select: { currentBalance: true },
  });

  const newBalance = updated.currentBalance;
  const expectedNew = previousBalance.plus(amount);

  if (!newBalance.equals(expectedNew)) {
    throw new Error(
      `Dealer balance increment mismatch for ${dealerCode}: expected ${expectedNew.toFixed(2)}, got ${newBalance.toFixed(2)}`,
    );
  }

  const ledgerEntry = await createLedgerEntry(
    buildIncreaseLedgerPostingInput(input, previousBalance),
  );

  assertLedgerBalanceMatchesCache(dealerCode, ledgerEntry.balance, newBalance);

  const auditPayload: Prisma.JsonObject = {
    referenceType,
    referenceId,
    referenceNo,
    amount: amount.toFixed(2),
    previousBalance: previousBalance.toFixed(2),
    newBalance: newBalance.toFixed(2),
    ledgerEntryId: ledgerEntry.id,
    ledgerPostingKey: ledgerEntry.postingKey,
    ledgerPostingType: ledgerEntry.postingType,
    ledgerIsNew: String(ledgerEntry.isNew),
    ...(input.metadata ?? {}),
  };

  await tx.auditLog.create({
    data: {
      userId,
      entityType: DEALER_ENTITY_TYPE,
      entityId: dealerCode,
      action: DEALER_BALANCE_UPDATED_ACTION,
      oldValue: { currentBalance: previousBalance.toFixed(2) },
      newValue: auditPayload,
    },
  });

  return { previousBalance, newBalance };
}

/**
 * Decreases dealer receivable balance for collection cash receipt.
 *
 * When `applyDealerBalance` is true (default), atomically decrements
 * `Dealer.currentBalance` AND appends a `LedgerEntry` (postingType =
 * `Collection`). When false, the ledger is not touched — allocation flows
 * (which do not post cash) continue to skip the balance and ledger paths.
 */
export async function postReceivableDecrease(
  input: ReceivableDecreasePostingInput,
): Promise<ReceivableDecreasePostingResult> {
  const {
    tx,
    dealerCode,
    amount,
    previousBalance,
    userId,
    referenceType,
    referenceId,
    referenceNo,
    collectionId,
    collectionNo,
    applyDealerBalance = true,
  } = input;

  if (amount.lessThanOrEqualTo(0)) {
    throw new RangeError("Receivable decrease amount must be positive");
  }

  let newBalance = previousBalance;
  let ledgerEntry: LedgerPostingResult | null = null;

  if (applyDealerBalance) {
    const updated = await tx.dealer.update({
      where: { dealerCode },
      data: { currentBalance: { decrement: amount } },
      select: { currentBalance: true },
    });

    newBalance = updated.currentBalance;
    const expectedNew = previousBalance.minus(amount);

    if (!newBalance.equals(expectedNew)) {
      throw new Error(
        `Dealer balance decrement mismatch for ${dealerCode}: expected ${expectedNew.toFixed(2)}, got ${newBalance.toFixed(2)}`,
      );
    }

    ledgerEntry = await createLedgerEntry(
      buildDecreaseLedgerPostingInput(input, previousBalance),
    );

    assertLedgerBalanceMatchesCache(dealerCode, ledgerEntry.balance, newBalance);
  }

  const collection = await tx.collection.findUnique({
    where: { id: collectionId },
    select: {
      receivedAmount: true,
      allocatedAmount: true,
      unallocatedAmount: true,
    },
  });

  if (!collection) {
    throw new Error(`Collection not found for posting: ${collectionId}`);
  }

  const auditPayload: Prisma.JsonObject = {
    collectionNo,
    dealerCode,
    referenceType,
    referenceId,
    referenceNo,
    amount: amount.toFixed(2),
    previousBalance: previousBalance.toFixed(2),
    newBalance: newBalance.toFixed(2),
    applyDealerBalance: String(applyDealerBalance),
    ...(ledgerEntry
      ? {
          ledgerEntryId: ledgerEntry.id,
          ledgerPostingKey: ledgerEntry.postingKey,
          ledgerPostingType: ledgerEntry.postingType,
          ledgerIsNew: String(ledgerEntry.isNew),
        }
      : {}),
    ...(input.metadata ?? {}),
  };

  await tx.auditLog.create({
    data: {
      userId,
      entityType: DEALER_ENTITY_TYPE,
      entityId: dealerCode,
      action: DEALER_BALANCE_DECREASED_ACTION,
      oldValue: { currentBalance: previousBalance.toFixed(2) },
      newValue: auditPayload,
    },
  });

  return {
    previousBalance,
    newBalance,
    allocatedAmount: collection.allocatedAmount,
    unallocatedAmount: collection.unallocatedAmount,
  };
}

/**
 * Reverses a collection cash receipt by increasing dealer receivable balance
 * AND appending a compensating `LedgerEntry` (postingType = `Reversal`).
 *
 * The reversal entry is linked to the original `Collection` posting via
 * `reversesEntryId` whenever a canonical original entry can be located by
 * `postingKey`. Legacy collections confirmed before PHASE_07B (no ledger row)
 * still receive a compensating entry — the link is simply null.
 *
 * The ledger is never mutated in place — corrections are always compensating
 * entries (ADR-025 §3, ADR-026 §4).
 */
export async function postReceivableDecreaseReversal(
  input: Omit<ReceivableDecreasePostingInput, "applyDealerBalance">,
): Promise<ReceivablePostingResult> {
  const {
    tx,
    dealerCode,
    amount,
    previousBalance,
    userId,
    referenceType,
    referenceId,
    referenceNo,
    collectionId,
    collectionNo,
  } = input;

  if (amount.lessThanOrEqualTo(0)) {
    throw new RangeError("Receivable reversal amount must be positive");
  }

  const updated = await tx.dealer.update({
    where: { dealerCode },
    data: { currentBalance: { increment: amount } },
    select: { currentBalance: true },
  });

  const newBalance = updated.currentBalance;
  const expectedNew = previousBalance.plus(amount);

  if (!newBalance.equals(expectedNew)) {
    throw new Error(
      `Dealer balance reversal mismatch for ${dealerCode}: expected ${expectedNew.toFixed(2)}, got ${newBalance.toFixed(2)}`,
    );
  }

  const originalPostingKey = buildLedgerPostingKey({
    referenceType: FINANCIAL_REFERENCE_COLLECTION,
    referenceId: collectionId,
    postingType: LedgerPostingType.Collection,
  });

  const originalEntry = await tx.ledgerEntry.findUnique({
    where: { postingKey: originalPostingKey },
    select: { id: true },
  });

  const ledgerEntry = await createLedgerEntry(
    buildReversalLedgerPostingInput(input, previousBalance, originalEntry?.id ?? null),
  );

  assertLedgerBalanceMatchesCache(dealerCode, ledgerEntry.balance, newBalance);

  const auditPayload: Prisma.JsonObject = {
    collectionNo,
    dealerCode,
    referenceType,
    referenceId,
    referenceNo,
    amount: amount.toFixed(2),
    previousBalance: previousBalance.toFixed(2),
    newBalance: newBalance.toFixed(2),
    reversal: "true",
    ledgerEntryId: ledgerEntry.id,
    ledgerPostingKey: ledgerEntry.postingKey,
    ledgerPostingType: ledgerEntry.postingType,
    ledgerReversesEntryId: ledgerEntry.reversesEntryId ?? "",
    ledgerIsNew: String(ledgerEntry.isNew),
    ...(input.metadata ?? {}),
  };

  await tx.auditLog.create({
    data: {
      userId,
      entityType: DEALER_ENTITY_TYPE,
      entityId: dealerCode,
      action: DEALER_BALANCE_UPDATED_ACTION,
      oldValue: { currentBalance: previousBalance.toFixed(2) },
      newValue: auditPayload,
    },
  });

  return { previousBalance, newBalance };
}

/**
 * Posts a dealer's Opening Balance — PHASE_07C Financial Initialization Engine.
 *
 * This is the ONLY function the initialization engine
 * (`src/lib/finance/initialization/`) may call to mutate `Dealer.currentBalance`
 * or the ledger. It never bypasses `createLedgerEntry`, exactly mirroring
 * `postReceivableIncrease` / `postReceivableDecrease` above.
 *
 * Sign convention matches `Dealer.currentBalance`: positive `amount` = dealer
 * owes company (debit), negative = advance credit (credit), zero = no-op.
 *
 * Zero amount is a valid opening balance (a dealer going live with nothing
 * outstanding) but produces NO `LedgerEntry` — `buildOpeningBalancePosting`
 * rejects zero as a no-op ledger line, so this function short-circuits the
 * ledger write while still updating the audit trail. `previousBalance` MUST
 * be `0.00`; this is asserted here AND inside `buildOpeningBalancePosting`.
 *
 * Idempotency: the derived `postingKey` (`ledger:OpeningBalance:OB-<dealerCode>:OpeningBalance`)
 * is unique per dealer, so a retried post for the same dealer replays the
 * existing ledger row instead of creating a duplicate (see `createLedgerEntry`).
 *
 * @see ADR-028, FINANCIAL_INVARIANTS.md §18
 */
export async function postOpeningBalance(
  input: OpeningBalancePostingInput,
): Promise<OpeningBalancePostingResult> {
  const {
    tx,
    dealerCode,
    amount,
    previousBalance,
    userId,
    effectiveDate,
    referenceNo,
    openingBalanceId,
    remarks,
  } = input;

  if (!previousBalance.equals(ZERO)) {
    throw new RangeError(
      `Opening balance requires previousBalance = 0.00 for ${dealerCode}, got ${previousBalance.toFixed(2)}`,
    );
  }

  if (amount.equals(ZERO)) {
    const auditPayload: Prisma.JsonObject = {
      openingBalanceId,
      referenceNo,
      amount: "0.00",
      previousBalance: "0.00",
      newBalance: "0.00",
      ledgerEntryCreated: "false",
      ...(input.metadata ?? {}),
    };

    await tx.auditLog.create({
      data: {
        userId,
        entityType: DEALER_ENTITY_TYPE,
        entityId: dealerCode,
        action: DEALER_OPENING_BALANCE_POSTED_ACTION,
        oldValue: { currentBalance: "0.00" },
        newValue: auditPayload,
      },
    });

    return {
      previousBalance: ZERO,
      newBalance: ZERO,
      ledgerEntryId: null,
      ledgerPostingKey: null,
    };
  }

  const isIncrease = amount.greaterThan(ZERO);
  const updated = await tx.dealer.update({
    where: { dealerCode },
    data: isIncrease
      ? { currentBalance: { increment: amount } }
      : { currentBalance: { decrement: amount.abs() } },
    select: { currentBalance: true },
  });

  const newBalance = updated.currentBalance;
  const expectedNew = previousBalance.plus(amount);

  if (!newBalance.equals(expectedNew)) {
    throw new Error(
      `Dealer balance opening-balance mismatch for ${dealerCode}: expected ${expectedNew.toFixed(2)}, got ${newBalance.toFixed(2)}`,
    );
  }

  const ledgerEntry = await createLedgerEntry(
    buildOpeningBalancePosting({
      tx,
      previousBalance,
      input: {
        dealerCode,
        amount,
        effectiveDate,
        referenceNo,
        createdById: userId,
        remarks: remarks ?? null,
      },
    }),
  );

  assertLedgerBalanceMatchesCache(dealerCode, ledgerEntry.balance, newBalance);

  const auditPayload: Prisma.JsonObject = {
    openingBalanceId,
    referenceNo,
    amount: amount.toFixed(2),
    previousBalance: previousBalance.toFixed(2),
    newBalance: newBalance.toFixed(2),
    ledgerEntryCreated: "true",
    ledgerEntryId: ledgerEntry.id,
    ledgerPostingKey: ledgerEntry.postingKey,
    ledgerPostingType: ledgerEntry.postingType,
    ledgerIsNew: String(ledgerEntry.isNew),
    ...(input.metadata ?? {}),
  };

  await tx.auditLog.create({
    data: {
      userId,
      entityType: DEALER_ENTITY_TYPE,
      entityId: dealerCode,
      action: DEALER_OPENING_BALANCE_POSTED_ACTION,
      oldValue: { currentBalance: previousBalance.toFixed(2) },
      newValue: auditPayload,
    },
  });

  return {
    previousBalance,
    newBalance,
    ledgerEntryId: ledgerEntry.id,
    ledgerPostingKey: ledgerEntry.postingKey,
  };
}

/**
 * Build the `LedgerPostingInput` for a receivable-increase (invoice issue,
 * future credit-note reversal, opening balance debit).
 *
 * `previousBalance` MUST come from the caller-held dealer lock snapshot — same
 * value the atomic `increment` used. This guarantees
 * `LedgerEntry.balance === Dealer.currentBalance` after the write.
 */
function buildIncreaseLedgerPostingInput(
  input: ReceivablePostingInput,
  previousBalance: Prisma.Decimal,
): LedgerPostingInput {
  return {
    tx: input.tx,
    dealerCode: input.dealerCode,
    transactionDate: input.transactionDate ?? new Date(),
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    referenceNo: input.referenceNo,
    postingType: input.postingType ?? LedgerPostingType.Issue,
    postingKey: input.postingKey,
    debit: input.amount,
    credit: ZERO,
    previousBalance,
    reversesEntryId: input.reversesEntryId,
    createdById: input.userId,
    remarks: input.metadata?.remarks ?? null,
  };
}

/**
 * Build the `LedgerPostingInput` for a receivable-decrease (collection cash
 * receipt). Debit sits at zero; credit carries the cash amount so the running
 * balance drops by exactly the cash received.
 */
function buildDecreaseLedgerPostingInput(
  input: ReceivableDecreasePostingInput,
  previousBalance: Prisma.Decimal,
): LedgerPostingInput {
  return {
    tx: input.tx,
    dealerCode: input.dealerCode,
    transactionDate: input.transactionDate ?? new Date(),
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    referenceNo: input.referenceNo,
    postingType: input.postingType ?? LedgerPostingType.Collection,
    postingKey: input.postingKey,
    debit: ZERO,
    credit: input.amount,
    previousBalance,
    reversesEntryId: input.reversesEntryId,
    createdById: input.userId,
    remarks: input.metadata?.remarks ?? null,
  };
}

/**
 * Build the compensating reversal `LedgerPostingInput` for a collection reverse.
 *
 * Sign convention: original `Collection` posting recorded a credit (cash in).
 * Reversal swaps the sides and records a debit for the same amount, restoring
 * the dealer receivable. `reversesEntryId` links to the original entry when
 * one exists (may be null for pre-PHASE_07B collections).
 */
function buildReversalLedgerPostingInput(
  input: Omit<ReceivableDecreasePostingInput, "applyDealerBalance">,
  previousBalance: Prisma.Decimal,
  originalEntryId: string | null,
): LedgerPostingInput {
  return {
    tx: input.tx,
    dealerCode: input.dealerCode,
    transactionDate: input.transactionDate ?? new Date(),
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    referenceNo: input.referenceNo,
    postingType: input.postingType ?? LedgerPostingType.Reversal,
    postingKey:
      input.postingKey ??
      buildLedgerPostingKey({
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        postingType: LedgerPostingType.Reversal,
      }),
    debit: input.amount,
    credit: ZERO,
    previousBalance,
    reversesEntryId: input.reversesEntryId ?? originalEntryId ?? undefined,
    createdById: input.userId,
    remarks: input.metadata?.remarks ?? null,
  };
}
