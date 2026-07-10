/**
 * Error types for the Scheduled Financial Integrity Monitor — PHASE_07E4.
 *
 * @see ADR-035
 */

export class LedgerMonitorError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "LedgerMonitorError";
    this.code = code;
  }
}

/** Raised when a persisted scan row cannot be found. */
export class IntegrityScanNotFoundError extends LedgerMonitorError {
  readonly scanId: string;

  constructor(scanId: string) {
    super("SCAN_NOT_FOUND", `Financial integrity scan not found: ${scanId}`);
    this.name = "IntegrityScanNotFoundError";
    this.scanId = scanId;
  }
}

/** Raised when scan persistence fails after reconciliation completed. */
export class IntegrityScanPersistenceError extends LedgerMonitorError {
  constructor(message: string) {
    super("SCAN_PERSISTENCE_FAILED", message);
    this.name = "IntegrityScanPersistenceError";
  }
}
