import { UserManagementError } from "./user-errors";

export class AuthTokenError extends UserManagementError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "AuthTokenError";
  }
}

export class TokenInvalidError extends AuthTokenError {
  constructor() {
    super("TOKEN_INVALID", "Token is invalid or has already been used");
    this.name = "TokenInvalidError";
  }
}

export class TokenExpiredError extends AuthTokenError {
  constructor() {
    super("TOKEN_EXPIRED", "Token has expired");
    this.name = "TokenExpiredError";
  }
}

export class TokenReplayError extends AuthTokenError {
  constructor() {
    super("TOKEN_REPLAY", "Token has already been consumed");
    this.name = "TokenReplayError";
  }
}

export class PasswordMismatchError extends AuthTokenError {
  constructor() {
    super("PASSWORD_MISMATCH", "Current password is incorrect");
    this.name = "PasswordMismatchError";
  }
}

export class WeakPasswordError extends AuthTokenError {
  constructor() {
    super("WEAK_PASSWORD", "Password does not meet security requirements");
    this.name = "WeakPasswordError";
  }
}

export class ActivationNotAllowedError extends AuthTokenError {
  constructor() {
    super("ACTIVATION_NOT_ALLOWED", "Account is not eligible for activation");
    this.name = "ActivationNotAllowedError";
  }
}
