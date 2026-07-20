/**
 * Typed errors for the SR Performance report engine — PHASE_12A / ADR-060.
 */

export type SrPerformanceErrorCode =
  | "INVALID_DATE_RANGE"
  | "INVALID_PAGINATION"
  | "EMPTY_TERRITORY_SCOPE"
  | "SR_OUT_OF_SCOPE"
  | "TERRITORY_OUT_OF_SCOPE"
  | "REPORT_CAP_EXCEEDED"
  | "VALIDATION_ERROR";

export class SrPerformanceError extends Error {
  readonly code: SrPerformanceErrorCode;

  constructor(code: SrPerformanceErrorCode, message: string) {
    super(message);
    this.name = "SrPerformanceError";
    this.code = code;
  }
}

export class EmptyTerritoryScopeError extends SrPerformanceError {
  constructor() {
    super("EMPTY_TERRITORY_SCOPE", "Authenticated user has no territory visibility");
    this.name = "EmptyTerritoryScopeError";
  }
}

export class SrOutOfScopeError extends SrPerformanceError {
  constructor(srId: string) {
    super("SR_OUT_OF_SCOPE", `SR ${srId} is outside the authenticated territory scope`);
    this.name = "SrOutOfScopeError";
  }
}

export class TerritoryOutOfScopeError extends SrPerformanceError {
  constructor(territoryId: string) {
    super(
      "TERRITORY_OUT_OF_SCOPE",
      `Territory ${territoryId} is outside the authenticated territory scope`,
    );
    this.name = "TerritoryOutOfScopeError";
  }
}
