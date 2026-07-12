export type AuthErrorCode =
  | "VALIDATION_ERROR"
  | "TOKEN_INVALID"
  | "TOKEN_EXPIRED"
  | "TOKEN_REPLAY"
  | "PASSWORD_MISMATCH"
  | "ACTIVATION_NOT_ALLOWED"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

export interface AuthFieldError {
  field: string;
  messageKey: string;
}

export interface AuthActionError {
  code: AuthErrorCode;
  messageKey: string;
  fieldErrors?: AuthFieldError[];
}

export type AuthActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: AuthActionError };

export interface ActivationValidationDTO {
  email: string;
  name: string;
}

export interface PasswordResetValidationDTO {
  email: string;
}

export interface PasswordResetRequestDTO {
  /** Token returned for infrastructure/testing — not exposed in production UI. */
  resetToken: string | null;
}
