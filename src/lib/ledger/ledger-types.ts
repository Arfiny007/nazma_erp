import type {
  FinancialReferenceType,
  LedgerPostingType,
  Prisma,
} from "@prisma/client";

/**
 * Ledger foundation types.
 *
 * The ledger is a strongly typed, append-only accounting subledger for dealer
 * receivables (see ADR-024 §4, ADR-025). All monetary values are `Prisma.Decimal`
 * — never JS `number`. All inputs are immutable value objects; the ledger
 * service copies fields into the persisted row and never mutates the input.
 *
 * PHASE_07A defines the contract. PHASE_07B wires it into `posting-service.ts`.
 */

/** Re-export enums so consumers depend on `@/lib/ledger` alone. */
export type { FinancialReferenceType, LedgerPostingType };

/** `AuditLog.entityType` used when ledger side-effects need dedicated audit rows. */
export const LEDGER_ENTITY_TYPE = "LedgerEntry" as const;

/**
 * Ledger posting input — the immutable value object the ledger service accepts.
 *
 * The service will:
 *   1. Validate the input via `assertLedgerPostingInputValid`.
 *   2. Compute the running balance under the caller-held dealer lock.
 *   3. Insert a `LedgerEntry` row keyed by `postingKey`.
 *
 * `debit` and `credit` MUST satisfy the sign convention: exactly one of the two
 * is positive, the other is zero. This is enforced by `ledger-validation.ts`.
 */
export interface LedgerPostingInput {
  /** Active transaction client — ledger writes MUST share the caller's transaction. */
  tx: Prisma.TransactionClient;

  /** Dealer subledger owner. Caller must already hold the dealer row lock. */
  dealerCode: string;

  /**
   * Business/value date. Used for statement ordering. Ordinarily equals
   * `issueDate` / `collectionDate` of the source document.
   */
  transactionDate: Date;

  /** Source document type. See `FinancialReferenceType`. */
  referenceType: FinancialReferenceType;
  /** Source document primary key. */
  referenceId: string;
  /** Human-readable reference (`INV-000123`, `COL-000045`, `OB-2026-01`). */
  referenceNo: string;

  /** Accounting event that produced this entry. */
  postingType: LedgerPostingType;

  /**
   * Idempotency key. When omitted, the service derives it via
   * `buildLedgerPostingKey({ referenceType, referenceId, postingType })`.
   * Supply an explicit key only when a single business event must produce
   * multiple ledger rows (e.g., multi-line journal — reserved for future use).
   */
  postingKey?: string;

  /** Amount increasing dealer obligation. `≥ 0`. Exactly one of debit/credit > 0. */
  debit: Prisma.Decimal;
  /** Amount decreasing dealer obligation. `≥ 0`. Exactly one of debit/credit > 0. */
  credit: Prisma.Decimal;

  /**
   * Running balance snapshot captured under the dealer lock BEFORE this posting.
   * The ledger service adds `debit - credit` to derive the persisted
   * `LedgerEntry.balance`.
   */
  previousBalance: Prisma.Decimal;

  /** Optional link to the entry this posting compensates. Enables reversal chains. */
  reversesEntryId?: string;

  /** Actor for audit trail. Nullable to allow system-driven backfills. */
  createdById?: string | null;

  /** Narration displayed on statements and reports. */
  remarks?: string | null;
}

/**
 * Ledger posting result — returned by `createLedgerEntry`. Values are captured
 * from the persisted row, so downstream code can assert against
 * `Dealer.currentBalance` without a re-read.
 */
export interface LedgerPostingResult {
  id: string;
  postingKey: string;
  dealerCode: string;
  transactionDate: Date;
  postingDate: Date;
  referenceType: FinancialReferenceType;
  referenceId: string;
  referenceNo: string;
  postingType: LedgerPostingType;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  /** Running balance AFTER this entry — must equal `Dealer.currentBalance`. */
  balance: Prisma.Decimal;
  reversesEntryId: string | null;
  createdById: string | null;
  /** Whether the row was newly inserted (`true`) or already existed by `postingKey` (`false`). */
  isNew: boolean;
}

/**
 * Reconciliation snapshot for a single dealer.
 *
 * `drift` is `ledgerBalance - cachedBalance`. A non-zero drift indicates the
 * cache diverged from the subledger and must be investigated — never silently
 * corrected.
 */
export interface DealerLedgerReconciliation {
  dealerCode: string;
  cachedBalance: Prisma.Decimal;
  ledgerBalance: Prisma.Decimal;
  drift: Prisma.Decimal;
  lastEntryId: string | null;
  lastEntryPostingDate: Date | null;
  entryCount: number;
  isReconciled: boolean;
}

/**
 * Compact projection of a persisted ledger entry — for reconciliation, reports,
 * and audit joins. `balance` is the running balance after the entry, matching
 * the sign convention on `Dealer.currentBalance` (positive = dealer owes).
 */
export interface LedgerEntrySnapshot {
  id: string;
  dealerCode: string;
  postingKey: string;
  transactionDate: Date;
  postingDate: Date;
  referenceType: FinancialReferenceType;
  referenceId: string;
  referenceNo: string;
  postingType: LedgerPostingType;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  balance: Prisma.Decimal;
  reversesEntryId: string | null;
  createdById: string | null;
  remarks: string | null;
}

/**
 * Opening balance descriptor — used by PHASE_07C onboarding to seed the ledger
 * with a dealer's initial receivable (positive) or advance credit (negative).
 * The helper `buildOpeningBalancePosting` converts this into a
 * `LedgerPostingInput` with the correct sign.
 */
export interface OpeningBalanceInput {
  dealerCode: string;
  /** Signed opening amount. Positive = dealer owes; negative = advance credit. */
  amount: Prisma.Decimal;
  /** Effective date of the opening balance. */
  effectiveDate: Date;
  /** Business reference (e.g., `OB-2026-01-DLR001`). */
  referenceNo: string;
  /** Actor performing the onboarding. */
  createdById?: string | null;
  remarks?: string | null;
}
