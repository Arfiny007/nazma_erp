export class AuditError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuditError";
  }
}

export class EmptyAuditScopeError extends AuditError {
  constructor() {
    super("EMPTY_SCOPE", "No territory scope available for audit visibility");
  }
}

export class UnsupportedAuditRoleError extends AuditError {
  constructor(role: string) {
    super("UNSUPPORTED_ROLE", `Audit console does not support role: ${role}`);
  }
}
