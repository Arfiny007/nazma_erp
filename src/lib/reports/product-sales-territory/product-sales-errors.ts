/**
 * Typed errors for Territory-wise Product Sales — PHASE_12B / ADR-061.
 */

export type ProductSalesErrorCode =
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "INVALID_DATE_RANGE"
  | "INVALID_PAGINATION"
  | "EMPTY_TERRITORY_SCOPE"
  | "TERRITORY_OUT_OF_SCOPE"
  | "INTERNAL_ERROR";

export class ProductSalesError extends Error {
  readonly code: ProductSalesErrorCode;

  constructor(code: ProductSalesErrorCode, message: string) {
    super(message);
    this.name = "ProductSalesError";
    this.code = code;
  }
}

export class EmptyTerritoryScopeError extends ProductSalesError {
  constructor(message = "No territory scope available for product sales report") {
    super("EMPTY_TERRITORY_SCOPE", message);
    this.name = "EmptyTerritoryScopeError";
  }
}

export class TerritoryOutOfScopeError extends ProductSalesError {
  constructor(message = "Territory is outside authenticated scope") {
    super("TERRITORY_OUT_OF_SCOPE", message);
    this.name = "TerritoryOutOfScopeError";
  }
}
