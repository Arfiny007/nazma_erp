import type { NotificationStatus } from "@prisma/client";

import {
  NotificationLifecycleError,
  NotificationValidationError,
} from "./notification-errors";
import type {
  NotificationSearchFilters,
  NotificationTemplateSearchFilters,
} from "./notification-types";
import {
  DEFAULT_NOTIFICATION_PAGE_SIZE,
  MAX_NOTIFICATION_PAGE_SIZE,
} from "./notification-types";

const ALLOWED_TRANSITIONS: Readonly<
  Record<NotificationStatus, readonly NotificationStatus[]>
> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SENT", "FAILED"],
  SENT: [],
  FAILED: ["PROCESSING"],
  CANCELLED: [],
};

export function assertNotificationTransition(
  from: NotificationStatus,
  to: NotificationStatus,
): void {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new NotificationLifecycleError(from, to);
  }
}

export function canRetryNotification(
  status: NotificationStatus,
  retryCount: number,
  maxRetries: number,
): boolean {
  return status === "FAILED" && retryCount < maxRetries;
}

export function assertRecipient(recipient: string): void {
  const trimmed = recipient.trim();
  if (!trimmed) {
    throw new NotificationValidationError("Recipient is required");
  }
  if (trimmed.length > 320) {
    throw new NotificationValidationError("Recipient exceeds maximum length");
  }
}

export function normalizeNotificationFilters(
  filters: NotificationSearchFilters,
): Required<
  Pick<NotificationSearchFilters, "page" | "pageSize">
> &
  NotificationSearchFilters {
  const page =
    Number.isFinite(filters.page) && (filters.page ?? 0) > 0
      ? (filters.page as number)
      : 1;
  const requestedSize =
    Number.isFinite(filters.pageSize) && (filters.pageSize ?? 0) > 0
      ? (filters.pageSize as number)
      : DEFAULT_NOTIFICATION_PAGE_SIZE;
  const pageSize = Math.min(requestedSize, MAX_NOTIFICATION_PAGE_SIZE);

  return {
    ...filters,
    page,
    pageSize,
    recipient: filters.recipient?.trim() || undefined,
    search: filters.search?.trim() || undefined,
  };
}

export function normalizeTemplateFilters(
  filters: NotificationTemplateSearchFilters,
): Required<
  Pick<NotificationTemplateSearchFilters, "page" | "pageSize">
> &
  NotificationTemplateSearchFilters {
  const page =
    Number.isFinite(filters.page) && (filters.page ?? 0) > 0
      ? (filters.page as number)
      : 1;
  const requestedSize =
    Number.isFinite(filters.pageSize) && (filters.pageSize ?? 0) > 0
      ? (filters.pageSize as number)
      : DEFAULT_NOTIFICATION_PAGE_SIZE;
  const pageSize = Math.min(requestedSize, MAX_NOTIFICATION_PAGE_SIZE);

  return {
    ...filters,
    page,
    pageSize,
    key: filters.key?.trim() || undefined,
    locale: filters.locale?.trim() || undefined,
    search: filters.search?.trim() || undefined,
  };
}
