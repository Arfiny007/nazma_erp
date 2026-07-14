import type {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from "@prisma/client";

export type NotificationTemplateKey =
  | "USER_ACTIVATION_EMAIL"
  | "PASSWORD_RESET_EMAIL"
  | "DUE_REMINDER_EMAIL"
  | "INTEGRITY_ALERT_EMAIL";

export const NOTIFICATION_TEMPLATE_PLACEHOLDERS = [
  "name",
  "link",
  "company",
  "date",
] as const;

export type NotificationPlaceholder =
  (typeof NOTIFICATION_TEMPLATE_PLACEHOLDERS)[number];

export type NotificationTemplateVariables = Partial<
  Record<NotificationPlaceholder, string>
>;

export interface NotificationPayload {
  notificationId: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient: string;
  subject: string | null;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationProvider {
  readonly name: string;
  send(payload: NotificationPayload): Promise<NotificationDeliveryResult>;
}

export interface NotificationDeliveryResult {
  success: boolean;
  provider: string;
  error?: string;
  messageId?: string;
}

export interface CreateNotificationInput {
  type: NotificationType;
  channel: NotificationChannel;
  recipient: string;
  subject?: string | null;
  payload: Record<string, unknown>;
  maxRetries?: number;
}

export interface NotificationSearchFilters {
  page?: number;
  pageSize?: number;
  status?: NotificationStatus;
  type?: NotificationType;
  channel?: NotificationChannel;
  recipient?: string;
  search?: string;
}

export interface NotificationTemplateSearchFilters {
  page?: number;
  pageSize?: number;
  key?: string;
  locale?: string;
  channel?: NotificationChannel;
  search?: string;
}

export interface NotificationRecord {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  recipient: string;
  subject: string | null;
  payload: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  queuedAt: string | null;
  processingStartedAt: string | null;
  nextRetryAt: string | null;
  lastAttemptAt: string | null;
  provider: string | null;
  providerMessageId: string | null;
  sentAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  attempts: NotificationAttemptRecord[];
}

export interface NotificationAttemptRecord {
  id: string;
  provider: string;
  status: NotificationStatus;
  error: string | null;
  attemptedAt: string;
}

export interface NotificationTemplateRecord {
  id: string;
  key: string;
  channel: NotificationChannel;
  locale: string;
  subject: string;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedNotifications {
  records: NotificationRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedNotificationTemplates {
  records: NotificationTemplateRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const DEFAULT_NOTIFICATION_PAGE_SIZE = 25;
export const MAX_NOTIFICATION_PAGE_SIZE = 100;
