/**
 * Error types for the Enterprise Reconciliation Engine — PHASE_07E3.
 *
 * Read-only module — errors cover query/validation failures only.
 *
 * @see ADR-034
 */

export class LedgerReconciliationEngineError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "LedgerReconciliationEngineError";
    this.code = code;
  }
}

/** Raised when a dealer cannot be found during reconciliation. */
export class DealerReconciliationNotFoundError extends LedgerReconciliationEngineError {
  readonly dealerCode: string;

  constructor(dealerCode: string) {
    super("DEALER_NOT_FOUND", `Dealer not found for reconciliation: ${dealerCode}`);
    this.name = "DealerReconciliationNotFoundError";
    this.dealerCode = dealerCode;
  }
}
