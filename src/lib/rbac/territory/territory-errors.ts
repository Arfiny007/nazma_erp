/**
 * Territory RBAC error types — PHASE_08B.
 */

export class TerritoryAccessDeniedError extends Error {
  constructor(message = "Territory access denied") {
    super(message);
    this.name = "TerritoryAccessDeniedError";
  }
}

export class TerritoryScopeUserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User not found for territory scope: ${userId}`);
    this.name = "TerritoryScopeUserNotFoundError";
  }
}
