import { NotificationError } from "./notification-errors";

export class AuthNotificationError extends NotificationError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "AuthNotificationError";
  }
}

export class AuthNotificationUserNotEligibleError extends AuthNotificationError {
  constructor(reason: string) {
    super("USER_NOT_ELIGIBLE", reason);
    this.name = "AuthNotificationUserNotEligibleError";
  }
}

export class AuthNotificationChannelUnsupportedError extends AuthNotificationError {
  constructor(channel: string) {
    super("CHANNEL_UNSUPPORTED", `Notification channel not supported: ${channel}`);
    this.name = "AuthNotificationChannelUnsupportedError";
  }
}

export class AuthNotificationResendForbiddenError extends AuthNotificationError {
  constructor() {
    super("FORBIDDEN", "Only Super Admin may resend authentication notifications");
    this.name = "AuthNotificationResendForbiddenError";
  }
}
