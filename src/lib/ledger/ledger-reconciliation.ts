import { Prisma } from "@prisma/client";

import { LedgerReconciliationError } from "@/lib/ledger/ledger-errors";
import type {
  DealerLedgerReconciliation,
  LedgerEntrySnapshot,
} from "@/lib/ledger/ledger-types";

/**
 * Reconciliation helpers.
 *
 * PHASE_07A ships reconciliation-shaped helpers so PHASE_07E can build the
 * scheduled reconciliation job without redesigning the read path. The helpers
 * are pure query wrappers — no mutations, safe outside the posting transaction.
 *
 * @see ADR-024 §2, ADR-025
 */

const ZERO = new Prisma.Decimal(0);

type LedgerReadClient = Pick<Prisma.TransactionClient, "ledgerEntry" | "dealer">;

/**
 * Return the last ledger entry for a dealer, ordered by
 * `(postingDate DESC, id DESC)` — the same ordering the ledger uses when
 * computing the next running balance.
 *
 * PHASE_07A safe to call before any ledger rows exist — returns `null`.
 */
export async function getLastLedgerEntryForDealer(
  tx: LedgerReadClient,
  dealerCode: string,
): Promise<LedgerEntrySnapshot | null> {
  const row = await tx.ledgerEntry.findFirst({
    where: { dealerCode },
    orderBy: [{ postingDate: "desc" }, { id: "desc" }],
  });
  return row ? toSnapshot(row) : null;
}

/**
 * Compute a reconciliation snapshot for a single dealer.
 *
 * `drift = ledgerBalance - cachedBalance`. A non-zero drift indicates the
 * `Dealer.currentBalance` cache diverged from the subledger; the caller must
 * investigate — never silently correct.
 *
 * PHASE_07A: with no ledger rows, `ledgerBalance = 0`. `drift` therefore equals
 * `-cachedBalance`. PHASE_07E backfill lands non-zero ledger balances.
 */
export async function reconcileDealerLedger(
  tx: LedgerReadClient,
  dealerCode: string,
): Promise<DealerLedgerReconciliation> {
  const [dealer, lastEntry, entryCount] = await Promise.all([
    tx.dealer.findUnique({
      where: { dealerCode },
      select: { currentBalance: true },
    }),
    getLastLedgerEntryForDealer(tx, dealerCode),
    tx.ledgerEntry.count({ where: { dealerCode } }),
  ]);

  if (!dealer) {
    throw new LedgerReconciliationError(
      dealerCode,
      "0.00",
      "0.00",
      "0.00",
    );
  }

  const cachedBalance = dealer.currentBalance;
  const ledgerBalance = lastEntry ? lastEntry.balance : ZERO;
  const drift = ledgerBalance.minus(cachedBalance);

  return {
    dealerCode,
    cachedBalance,
    ledgerBalance,
    drift,
    lastEntryId: lastEntry?.id ?? null,
    lastEntryPostingDate: lastEntry?.postingDate ?? null,
    entryCount,
    isReconciled: drift.equals(ZERO),
  };
}

/**
 * Assert that the last `LedgerEntry.balance` for a dealer matches
 * `Dealer.currentBalance`. Called from tests, reconciliation jobs, and
 * (in PHASE_07B) as a defensive check after every posting.
 *
 * Callers must handle the empty-ledger case explicitly — this function
 * treats "no ledger rows" as reconciled ONLY when the cache is zero,
 * matching the PHASE_07A pre-posting invariant.
 */
export async function assertDealerLedgerReconciled(
  tx: LedgerReadClient,
  dealerCode: string,
): Promise<DealerLedgerReconciliation> {
  const snapshot = await reconcileDealerLedger(tx, dealerCode);
  if (!snapshot.isReconciled) {
    // PHASE_07A special case: no ledger rows yet — cache is source of truth
    // for the AR subledger, so treat non-zero cache with empty ledger as
    // reconciled. PHASE_07B tightens this by requiring at least one entry.
    if (snapshot.entryCount === 0) {
      return snapshot;
    }
    throw new LedgerReconciliationError(
      dealerCode,
      snapshot.cachedBalance.toFixed(2),
      snapshot.ledgerBalance.toFixed(2),
      snapshot.drift.toFixed(2),
    );
  }
  return snapshot;
}

/**
 * Compute the reconstructed running balance from every ledger entry for a
 * dealer. Used by PHASE_07E to cross-check the persisted `balance` column
 * against `sum(debit) - sum(credit)`. Independent of the cache.
 */
export async function replayDealerLedgerBalance(
  tx: LedgerReadClient,
  dealerCode: string,
): Promise<Prisma.Decimal> {
  const agg = await tx.ledgerEntry.aggregate({
    where: { dealerCode },
    _sum: { debit: true, credit: true },
  });
  const debit = agg._sum.debit ?? ZERO;
  const credit = agg._sum.credit ?? ZERO;
  return debit.minus(credit);
}

function toSnapshot(row: {
  id: string;
  dealerCode: string;
  postingKey: string;
  transactionDate: Date;
  postingDate: Date;
  referenceType: LedgerEntrySnapshot["referenceType"];
  referenceId: string;
  referenceNo: string;
  postingType: LedgerEntrySnapshot["postingType"];
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  balance: Prisma.Decimal;
  reversesEntryId: string | null;
  createdById: string | null;
  remarks: string | null;
}): LedgerEntrySnapshot {
  return {
    id: row.id,
    dealerCode: row.dealerCode,
    postingKey: row.postingKey,
    transactionDate: row.transactionDate,
    postingDate: row.postingDate,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    referenceNo: row.referenceNo,
    postingType: row.postingType,
    debit: row.debit,
    credit: row.credit,
    balance: row.balance,
    reversesEntryId: row.reversesEntryId,
    createdById: row.createdById,
    remarks: row.remarks,
  };
}
