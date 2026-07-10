/**
 * Due Report domain errors — PHASE_08D.
 */

export class DueReportError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "DueReportError";
    this.code = code;
  }
}

export class DealerDueNotFoundError extends DueReportError {
  readonly dealerCode: string;

  constructor(dealerCode: string) {
    super("DEALER_NOT_FOUND", `Dealer not found: ${dealerCode}`);
    this.name = "DealerDueNotFoundError";
    this.dealerCode = dealerCode;
  }
}
