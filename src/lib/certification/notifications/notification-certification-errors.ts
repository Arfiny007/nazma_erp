/**
 * Typed errors for Enterprise Notification Certification — PHASE_11D.
 *
 * @see ADR-056
 */

export class NotificationCertificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationCertificationError";
  }
}

export class NotificationCertificationCheckFailedError extends NotificationCertificationError {
  readonly checkId: string;

  constructor(checkId: string, message: string) {
    super(`[${checkId}] ${message}`);
    this.name = "NotificationCertificationCheckFailedError";
    this.checkId = checkId;
  }
}

export class NotificationCertificationBoundaryViolationError extends NotificationCertificationError {
  readonly file: string;
  readonly violation: string;

  constructor(file: string, violation: string) {
    super(`Financial/architecture boundary violation in ${file}: ${violation}`);
    this.name = "NotificationCertificationBoundaryViolationError";
    this.file = file;
    this.violation = violation;
  }
}
