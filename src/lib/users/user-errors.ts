export class UserManagementError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "UserManagementError";
    this.code = code;
  }
}

export class UserLifecycleError extends UserManagementError {
  readonly fromStatus: string;
  readonly toStatus: string;

  constructor(fromStatus: string, toStatus: string) {
    super("INVALID_TRANSITION", `Invalid lifecycle transition: ${fromStatus} → ${toStatus}`);
    this.name = "UserLifecycleError";
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

export class UserNotFoundError extends UserManagementError {
  constructor() {
    super("NOT_FOUND", "User not found");
    this.name = "UserNotFoundError";
  }
}

export class UserScopeDeniedError extends UserManagementError {
  constructor(reason: string) {
    super("FORBIDDEN", reason);
    this.name = "UserScopeDeniedError";
  }
}

export class UserEmailExistsError extends UserManagementError {
  constructor() {
    super("EMAIL_EXISTS", "Email already registered");
    this.name = "UserEmailExistsError";
  }
}

export class RoleEscalationError extends UserManagementError {
  constructor() {
    super("ROLE_ESCALATION", "Role escalation is not permitted");
    this.name = "RoleEscalationError";
  }
}
