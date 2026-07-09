/**
 * Ledger foundation — public surface.
 *
 * Only `posting-service.ts` should import `createLedgerEntry` (PHASE_07B onwards).
 * Reconciliation helpers may be used by pre-production QA and PHASE_07E jobs.
 * Business modules import types only.
 *
 * @see ADR-025
 */

export {
  LedgerError,
  LedgerPostingValidationError,
  LedgerDuplicatePostingError,
  LedgerBalanceMismatchError,
  LedgerImmutabilityError,
  LedgerReconciliationError,
} from "@/lib/ledger/ledger-errors";

export {
  LEDGER_ENTITY_TYPE,
  type FinancialReferenceType,
  type LedgerPostingType,
  type LedgerPostingInput,
  type LedgerPostingResult,
  type LedgerEntrySnapshot,
  type DealerLedgerReconciliation,
  type OpeningBalanceInput,
} from "@/lib/ledger/ledger-types";

export {
  LEDGER_POSTING_KEY_NAMESPACE,
  LEDGER_POSTING_KEY_SEPARATOR,
  buildLedgerPostingKey,
  parseLedgerPostingKey,
  isLedgerPostingKey,
  type LedgerPostingKeyDescriptor,
} from "@/lib/ledger/posting-key";

export {
  assertLedgerPostingInputValid,
  applyPostingToBalance,
  assertLedgerAppendOnly,
} from "@/lib/ledger/ledger-validation";

export {
  buildLedgerEntryCreateData,
  buildReversalPosting,
  type LedgerEntryCreateData,
} from "@/lib/ledger/ledger-posting";

export {
  createLedgerEntry,
  assertLedgerBalanceMatchesCache,
} from "@/lib/ledger/ledger-service";

export {
  getLastLedgerEntryForDealer,
  reconcileDealerLedger,
  assertDealerLedgerReconciled,
  replayDealerLedgerBalance,
  validateDealerLedgerChain,
  assertDealerLedgerIntegrity,
  reconcileAllDealers,
  type DealerLedgerChainValidation,
  type RepositoryLedgerReconciliation,
} from "@/lib/ledger/ledger-reconciliation";

export {
  OPENING_BALANCE_REFERENCE_PREFIX,
  buildOpeningBalanceReferenceId,
  buildOpeningBalancePostingKey,
  buildOpeningBalancePosting,
} from "@/lib/ledger/opening-balance";

export {
  getDealerStatement,
  getDealerStatementSummary,
  DealerNotFoundError,
  DealerStatementError,
  InvalidDateRangeError,
  InvalidPaginationError,
} from "@/lib/ledger/statement";
export type {
  DealerStatementResult,
  DealerStatementSummaryResult,
  GetDealerStatementParams,
  GetDealerStatementSummaryParams,
  StatementRow,
  StatementTotals,
} from "@/lib/ledger/statement";
