/**
 * Analytics layer errors — PHASE_09B.
 */

export class AnalyticsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyticsError";
  }
}

export class EmptyAnalyticsScopeError extends AnalyticsError {
  constructor() {
    super("Territory scope is empty — no analytics available");
    this.name = "EmptyAnalyticsScopeError";
  }
}

export class UnsupportedAnalyticsRoleError extends AnalyticsError {
  constructor(role: string) {
    super(`Unsupported analytics role: ${role}`);
    this.name = "UnsupportedAnalyticsRoleError";
  }
}
