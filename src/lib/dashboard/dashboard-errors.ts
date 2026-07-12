/**
 * Dashboard domain errors — PHASE_09A.
 */

export type DashboardErrorCode =
  | "UNSUPPORTED_ROLE"
  | "EMPTY_SCOPE"
  | "INTERNAL_ERROR";

export class DashboardError extends Error {
  readonly code: DashboardErrorCode;

  constructor(code: DashboardErrorCode, message: string) {
    super(message);
    this.name = "DashboardError";
    this.code = code;
  }
}

export class UnsupportedDashboardRoleError extends DashboardError {
  constructor(role: string) {
    super("UNSUPPORTED_ROLE", `Dashboard is not available for role: ${role}`);
  }
}

export class EmptyTerritoryScopeError extends DashboardError {
  constructor() {
    super("EMPTY_SCOPE", "User has no accessible territories for dashboard scope");
  }
}
