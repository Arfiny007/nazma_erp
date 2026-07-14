export type {
  CreateNotificationInput,
  NotificationAttemptRecord,
  NotificationDeliveryResult,
  NotificationPayload,
  NotificationPlaceholder,
  NotificationRecord,
  NotificationSearchFilters,
  NotificationTemplateKey,
  NotificationTemplateRecord,
  NotificationTemplateSearchFilters,
  NotificationTemplateVariables,
  PaginatedNotifications,
  PaginatedNotificationTemplates,
} from "./notification-types";

export {
  DEFAULT_NOTIFICATION_PAGE_SIZE,
  MAX_NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_TEMPLATE_PLACEHOLDERS,
} from "./notification-types";

export {
  NotificationError,
  NotificationLifecycleError,
  NotificationNotFoundError,
  NotificationRetryExhaustedError,
  NotificationTemplateNotFoundError,
  NotificationValidationError,
} from "./notification-errors";

export {
  assertNotificationTransition,
  canRetryNotification,
  normalizeNotificationFilters,
  normalizeTemplateFilters,
} from "./notification-validation";

export {
  NOTIFICATION_AUDIT_ENTITY_TYPE,
  recordNotificationAudit,
} from "./notification-audit";
export type { NotificationAuditAction } from "./notification-audit";

export {
  ConsoleEmailProvider,
  getActiveEmailProviderName,
  getEmailProviderHealth,
  resetProviderCache,
  resolveNotificationProvider,
} from "./notification-provider";
export type { NotificationProvider } from "./notification-types";

export {
  getTemplate,
  renderNotificationTemplate,
  renderTemplateByKey,
  searchTemplates,
} from "./notification-template-service";

export {
  claimNotificationBatch,
  listPendingNotifications,
  markNotificationFailed,
  markNotificationProcessing,
  markNotificationSent,
  normalizeBatchSize,
  processPendingNotifications,
  queueNotification,
  retryFailedNotifications,
  getNotificationMetrics,
} from "./notification-queue";

export { computeNextRetryAt, isEligibleForProcessing } from "./worker/notification-scheduler";

export {
  cancelNotification,
  createNotification,
  getNotification,
  retryNotification,
  searchNotifications,
  sendNotification,
} from "./notification-service";

export {
  dispatchActivationNotification,
  dispatchPasswordResetNotification,
  resendActivationNotification,
  resendPasswordResetNotification,
} from "./auth-notifications";

export {
  AuthNotificationChannelUnsupportedError,
  AuthNotificationResendForbiddenError,
  AuthNotificationUserNotEligibleError,
} from "./auth-notification-errors";

export {
  buildActivationNotificationPayload,
  buildPasswordResetNotificationPayload,
  formatNotificationDate,
  toActivationTemplateVariables,
  toPasswordResetTemplateVariables,
} from "./auth-template-mappers";
export type {
  ActivationNotificationPayload,
  PasswordResetNotificationPayload,
} from "./auth-template-mappers";
