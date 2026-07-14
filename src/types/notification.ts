import type {
  NotificationRecord,
  NotificationSearchFilters,
  NotificationTemplateRecord,
  PaginatedNotifications,
  PaginatedNotificationTemplates,
} from "@/lib/notifications";

export type ActionResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: {
        code: NotificationActionErrorCode;
        messageKey: string;
        fieldErrors?: NotificationFieldError[];
      };
    };

export type NotificationActionErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "RETRY_EXHAUSTED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export interface NotificationFieldError {
  field: string;
  messageKey: string;
}

export type NotificationDTO = NotificationRecord;
export type NotificationTemplateDTO = NotificationTemplateRecord;
export type NotificationListDTO = PaginatedNotifications;
export type NotificationTemplateListDTO = PaginatedNotificationTemplates;

export type { NotificationSearchFilters };
