export class OwnershipNotFoundError extends Error {
  constructor() {
    super("OWNERSHIP_NOT_FOUND");
    this.name = "OwnershipNotFoundError";
  }
}

export class DealerNotFoundError extends Error {
  constructor() {
    super("DEALER_NOT_FOUND");
    this.name = "DealerNotFoundError";
  }
}

export class TerritoryNotFoundError extends Error {
  constructor() {
    super("TERRITORY_NOT_FOUND");
    this.name = "TerritoryNotFoundError";
  }
}

export class TerritoryNotAssignableError extends Error {
  constructor() {
    super("TERRITORY_NOT_ASSIGNABLE");
    this.name = "TerritoryNotAssignableError";
  }
}

export class ActiveOwnershipConflictError extends Error {
  constructor() {
    super("ACTIVE_OWNERSHIP_EXISTS");
    this.name = "ActiveOwnershipConflictError";
  }
}

export class OwnershipConflictError extends Error {
  constructor() {
    super("OWNERSHIP_CONFLICT");
    this.name = "OwnershipConflictError";
  }
}
