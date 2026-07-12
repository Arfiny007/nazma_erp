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

export { generateTemporaryPassword, hashPassword } from "./user-password";

export { toUserDetailDTO, toUserSummaryDTO } from "./user-mappers";
