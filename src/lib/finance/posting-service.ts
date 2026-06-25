import { Prisma } from "@prisma/client";

import {
  DEALER_BALANCE_UPDATED_ACTION,
  type ReceivablePostingInput,
  type ReceivablePostingResult,
} from "@/lib/finance/types";

/**
 * Financial Posting Service — single boundary for dealer balance mutations.
 *
 * Invoice Engine, Collections (future), Credit Notes (future), and Ledger
 * (future) must route balance changes through this module. Direct
 * `Dealer.currentBalance` updates from feature code are forbidden.
 *
 * PHASE_05C: updates balance + audit only. LedgerEntry posting deferred.
 * PHASE_05C2A: atomic `increment` — caller must hold dealer row lock and pass
 * `previousBalance` from the locked snapshot.
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
