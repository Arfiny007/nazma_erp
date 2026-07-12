/**
 * Enterprise User Management — public surface (PHASE_10A).
 *
 * @see ADR-049
 */

export {
  createUserRecord,
  updateUserRecord,
  activateUserRecord,
  disableUserRecord,
  resetUserTemporaryPassword,
  listUsersRecord,
  getUserRecord,
  searchUsersRecord,
  UserLifecycleError,
  UserNotFoundError,
  UserScopeDeniedError,
} from "./user-service";

export {
  assertLifecycleTransition,
  isLifecycleActive,
  lifecycleToIsActive,
  resolveInitialLifecycleStatus,
  canLoginWithLifecycle,
} from "./user-lifecycle";

export {
  assertCanCreateUser,
  assertCanViewUsers,
  assertCanUpdateUser,
  assertCanActivateUser,
  assertCanDisableUser,
  buildUserVisibilityWhere,
} from "./user-validation";

export {
  recordUserAudit,
  USER_AUDIT_ENTITY_TYPE,
  type UserAuditAction,
} from "./user-audit";

export { generateTemporaryPassword, hashPassword, verifyPassword } from "./user-password";

export {
  generateSecureToken,
  hashToken,
  isTokenExpired,
  buildActivationUrl,
  buildPasswordResetUrl,
  ACTIVATION_TOKEN_TTL_MS,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from "./user-tokens";

export {
  issueActivationToken,
  validateActivationToken,
  completeAccountActivation,
} from "./user-activation-service";

export {
  changeUserPassword,
  requestPasswordReset,
  validateResetToken,
  completePasswordReset,
} from "./user-password-reset-service";

export {
  AuthTokenError,
  TokenInvalidError,
  TokenExpiredError,
  TokenReplayError,
  PasswordMismatchError,
  WeakPasswordError,
  ActivationNotAllowedError,
} from "./auth-errors";

export { toUserDetailDTO, toUserSummaryDTO } from "./user-mappers";
