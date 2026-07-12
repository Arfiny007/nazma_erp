/**
 * Territory map errors — PHASE_09C.
 */

export class MapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MapError";
  }
}

export class EmptyMapScopeError extends MapError {
  constructor() {
    super("No territory scope available for map visualization");
    this.name = "EmptyMapScopeError";
  }
}

export class UnsupportedMapRoleError extends MapError {
  constructor(role: string) {
    super(`Unsupported map role: ${role}`);
    this.name = "UnsupportedMapRoleError";
  }
}

export class InvalidMapFiltersError extends MapError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMapFiltersError";
  }
}
