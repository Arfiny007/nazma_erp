import { Prisma } from "@prisma/client";

import {
  DEALER_BALANCE_UPDATED_ACTION,
  DEALER_BALANCE_DECREASED_ACTION,
  type ReceivableDecreasePostingInput,
  type ReceivableDecreasePostingResult,
  type ReceivablePostingInput,
  type ReceivablePostingResult,
} from "@/lib/finance/types";

/**
 * Financial Posting Service — single boundary for dealer balance mutations.
 *
 * Invoice Engine, Collections, Credit Notes (future), and Ledger (future)
 * must route balance changes through this module. Direct
 * `Dealer.currentBalance` updates from feature code are forbidden.
 *
 * PHASE_05C: updates balance + audit only. LedgerEntry posting deferred.
 * PHASE_05C2A: atomic `increment` — caller must hold dealer row lock and pass
 * `previousBalance` from the locked snapshot.
 * PHASE_06A2: `postReceivableDecrease()` for collection cash receipt and
 * allocation accounting.
 *
 * PHASE_07A: input contracts extended with optional ledger metadata
 * (`postingType`, `postingKey`, `transactionDate`, `reversesEntryId`) so
 * PHASE_07B can wire `createLedgerEntry` (from `@/lib/ledger`) inside these
 * function bodies without any caller-side changes. See ADR-025.
 */

const DEALER_ENTITY_TYPE = "Dealer";

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

  const auditPayload: Prisma.JsonObject = {
    referenceType,
    referenceId,
    referenceNo,
    amount: amount.toFixed(2),
    previousBalance: previousBalance.toFixed(2),
    newBalance: newBalance.toFixed(2),
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
 * Decreases dealer receivable balance for collection cash receipt or allocation.
 *
 * When `applyDealerBalance` is true (default), atomically decrements
 * `Dealer.currentBalance`. Set to false during invoice allocation when cash
 * was already posted on collection confirmation.
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
 * Reverses a collection cash receipt by increasing dealer receivable balance.
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
