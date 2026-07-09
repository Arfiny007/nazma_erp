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
 * Empty ledger is reconciled ONLY when `Dealer.currentBalance` is zero
 * (fresh dealer). Non-zero cache with no ledger rows indicates pre-PHASE_07B
 * data awaiting PHASE_07E backfill or PHASE_07C opening balance — not
 * reconciled.
 */
export async function assertDealerLedgerReconciled(
  tx: LedgerReadClient,
  dealerCode: string,
): Promise<DealerLedgerReconciliation> {
  const snapshot = await reconcileDealerLedger(tx, dealerCode);
  if (!snapshot.isReconciled) {
    if (snapshot.entryCount === 0 && snapshot.cachedBalance.equals(ZERO)) {
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

export interface DealerLedgerChainValidation {
  dealerCode: string;
  entryCount: number;
  replayBalance: Prisma.Decimal;
  lastEntryBalance: Prisma.Decimal;
  cachedBalance: Prisma.Decimal;
  isChainValid: boolean;
  isReplayValid: boolean;
  isCacheValid: boolean;
}

/**
 * Validate append-only ledger integrity for a single dealer:
 *   - Each entry balance = prior entry balance + debit − credit (i > 0)
 *   - SUM(debit) − SUM(credit) = last entry balance
 *   - Last entry balance = `Dealer.currentBalance`
 */
export async function validateDealerLedgerChain(
  tx: LedgerReadClient,
  dealerCode: string,
): Promise<DealerLedgerChainValidation> {
  const [dealer, entries] = await Promise.all([
    tx.dealer.findUnique({
      where: { dealerCode },
      select: { currentBalance: true },
    }),
    tx.ledgerEntry.findMany({
      where: { dealerCode },
      orderBy: [{ postingDate: "asc" }, { id: "asc" }],
      select: {
        debit: true,
        credit: true,
        balance: true,
      },
    }),
  ]);

  if (!dealer) {
    throw new LedgerReconciliationError(dealerCode, "0.00", "0.00", "0.00");
  }

  const cachedBalance = dealer.currentBalance;
  const entryCount = entries.length;

  if (entryCount === 0) {
    return {
      dealerCode,
      entryCount: 0,
      replayBalance: ZERO,
      lastEntryBalance: ZERO,
      cachedBalance,
      isChainValid: true,
      isReplayValid: cachedBalance.equals(ZERO),
      isCacheValid: cachedBalance.equals(ZERO),
    };
  }

  let isChainValid = true;
  let previousBalance = ZERO;

  for (const entry of entries) {
    const expected = previousBalance.plus(entry.debit).minus(entry.credit);
    if (!entry.balance.equals(expected)) {
      isChainValid = false;
      break;
    }
    previousBalance = entry.balance;
  }

  const replayBalance = await replayDealerLedgerBalance(tx, dealerCode);
  const lastEntryBalance = entries[entries.length - 1].balance;

  return {
    dealerCode,
    entryCount,
    replayBalance,
    lastEntryBalance,
    cachedBalance,
    isChainValid,
    isReplayValid: replayBalance.equals(lastEntryBalance),
    isCacheValid: lastEntryBalance.equals(cachedBalance),
  };
}

/**
 * Assert full ledger integrity for one dealer. Raises on any drift.
 */
export async function assertDealerLedgerIntegrity(
  tx: LedgerReadClient,
  dealerCode: string,
): Promise<DealerLedgerChainValidation> {
  const validation = await validateDealerLedgerChain(tx, dealerCode);

  if (validation.entryCount === 0) {
    if (!validation.isCacheValid) {
      throw new LedgerReconciliationError(
        dealerCode,
        validation.cachedBalance.toFixed(2),
        "0.00",
        validation.cachedBalance.negated().toFixed(2),
      );
    }
    return validation;
  }

  if (!validation.isChainValid) {
    throw new LedgerReconciliationError(
      dealerCode,
      validation.cachedBalance.toFixed(2),
      validation.lastEntryBalance.toFixed(2),
      "chain",
    );
  }

  if (!validation.isReplayValid) {
    throw new LedgerReconciliationError(
      dealerCode,
      validation.replayBalance.toFixed(2),
      validation.lastEntryBalance.toFixed(2),
      validation.replayBalance.minus(validation.lastEntryBalance).toFixed(2),
    );
  }

  if (!validation.isCacheValid) {
    throw new LedgerReconciliationError(
      dealerCode,
      validation.cachedBalance.toFixed(2),
      validation.lastEntryBalance.toFixed(2),
      validation.cachedBalance.minus(validation.lastEntryBalance).toFixed(2),
    );
  }

  return validation;
}

export interface RepositoryLedgerReconciliation {
  dealerCount: number;
  reconciledCount: number;
  unreconciledDealers: string[];
}

/**
 * Repository-wide reconciliation — every dealer must satisfy ledger integrity.
 * Used by certification tests and PHASE_07E scheduled jobs.
 */
export async function reconcileAllDealers(
  tx: LedgerReadClient & Pick<Prisma.TransactionClient, "dealer">,
): Promise<RepositoryLedgerReconciliation> {
  const dealers = await tx.dealer.findMany({
    select: { dealerCode: true },
    orderBy: { dealerCode: "asc" },
  });

  const unreconciledDealers: string[] = [];

  for (const { dealerCode } of dealers) {
    try {
      await assertDealerLedgerIntegrity(tx, dealerCode);
    } catch {
      unreconciledDealers.push(dealerCode);
    }
  }

  return {
    dealerCount: dealers.length,
    reconciledCount: dealers.length - unreconciledDealers.length,
    unreconciledDealers,
  };
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
