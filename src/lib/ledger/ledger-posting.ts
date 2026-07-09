import { Prisma } from "@prisma/client";

import {
  buildLedgerPostingKey,
  type LedgerPostingKeyDescriptor,
} from "@/lib/ledger/posting-key";
import type { LedgerPostingInput } from "@/lib/ledger/ledger-types";
import { applyPostingToBalance } from "@/lib/ledger/ledger-validation";

/**
 * Immutable ledger posting contracts.
 *
 * Value-object helpers that assemble the persisted row shape from a
 * `LedgerPostingInput`. Nothing in this module mutates its arguments — the
 * ledger service reuses these helpers so business modules see a single,
 * deterministic mapping between business events and ledger rows.
 *
 * PHASE_07A defines contracts only. PHASE_07B calls `createLedgerEntry` from
 * inside `posting-service.ts`.
 *
 * @see ADR-025
 */

/**
 * The exact `Prisma.LedgerEntryCreateInput` shape (using unchecked FK ids so
 * the ledger service can share the enclosing transaction).
 */
export type LedgerEntryCreateData = Prisma.LedgerEntryUncheckedCreateInput;

/**
 * Compose the persisted `LedgerEntry` row for a posting input.
 *
 * The caller is responsible for:
 *   - Holding the dealer row lock (`lockDealerForFinancialUpdate`).
 *   - Validating the input (`assertLedgerPostingInputValid`).
 *   - Persisting the row inside the shared transaction.
 *
 * `balance` is computed as `previousBalance + debit - credit` — signed so that
 * advance credit (negative AR) round-trips through the ledger.
 */
export function buildLedgerEntryCreateData(
  input: LedgerPostingInput,
): LedgerEntryCreateData {
  const postingKey =
    input.postingKey ??
    buildLedgerPostingKey({
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      postingType: input.postingType,
    });

  const balance = applyPostingToBalance(
    input.previousBalance,
    input.debit,
    input.credit,
  );

  return {
    dealerCode: input.dealerCode,
    transactionDate: input.transactionDate,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    referenceNo: input.referenceNo,
    postingType: input.postingType,
    postingKey,
    debit: input.debit,
    credit: input.credit,
    balance,
    reversesEntryId: input.reversesEntryId ?? null,
    createdById: input.createdById ?? null,
    remarks: input.remarks ?? null,
  };
}

/**
 * Convenience helper — describe a reversal posting for an existing entry.
 *
 * Returned `LedgerPostingInput` swaps debit/credit sides, links back to the
 * original entry via `reversesEntryId`, and stamps `postingType = Reversal`.
 * Callers still supply the dealer lock snapshot (`previousBalance`) and the
 * transaction client.
 */
export function buildReversalPosting(params: {
  tx: LedgerPostingInput["tx"];
  originalEntry: {
    id: string;
    dealerCode: string;
    referenceType: LedgerPostingInput["referenceType"];
    referenceId: string;
    referenceNo: string;
    debit: Prisma.Decimal;
    credit: Prisma.Decimal;
  };
  previousBalance: Prisma.Decimal;
  transactionDate: Date;
  createdById?: string | null;
  remarks?: string | null;
  /**
   * Reversal postings share the same `(referenceType, referenceId)` as the
   * original but change `postingType` to `Reversal`. When the original is
   * itself a reversal (uncommon), pass a deterministic `sequence` to keep
   * `postingKey` unique.
   */
  sequence?: number;
}): LedgerPostingInput {
  const descriptor: LedgerPostingKeyDescriptor = {
    referenceType: params.originalEntry.referenceType,
    referenceId: params.originalEntry.referenceId,
    postingType: "Reversal",
  };
  if (params.sequence !== undefined) {
    descriptor.sequence = params.sequence;
  }

  return {
    tx: params.tx,
    dealerCode: params.originalEntry.dealerCode,
    transactionDate: params.transactionDate,
    referenceType: params.originalEntry.referenceType,
    referenceId: params.originalEntry.referenceId,
    referenceNo: params.originalEntry.referenceNo,
    postingType: "Reversal",
    postingKey: buildLedgerPostingKey(descriptor),
    debit: params.originalEntry.credit,
    credit: params.originalEntry.debit,
    previousBalance: params.previousBalance,
    reversesEntryId: params.originalEntry.id,
    createdById: params.createdById ?? null,
    remarks: params.remarks ?? null,
  };
}
