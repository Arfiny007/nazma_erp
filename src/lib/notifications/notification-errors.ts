export class NotificationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "NotificationError";
    this.code = code;
  }
}

export class NotificationNotFoundError extends NotificationError {
  constructor() {
    super("NOT_FOUND", "Notification not found");
    this.name = "NotificationNotFoundError";
  }
}

export class NotificationTemplateNotFoundError extends NotificationError {
  constructor() {
    super("TEMPLATE_NOT_FOUND", "Notification template not found");
    this.name = "NotificationTemplateNotFoundError";
  }
}

export class NotificationLifecycleError extends NotificationError {
  readonly fromStatus: string;
  readonly toStatus: string;

  constructor(fromStatus: string, toStatus: string) {
    super(
      "INVALID_TRANSITION",
      `Invalid notification transition: ${fromStatus} → ${toStatus}`,
    );
    this.name = "NotificationLifecycleError";
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

export class NotificationRetryExhaustedError extends NotificationError {
  constructor() {
    super("RETRY_EXHAUSTED", "Maximum retry attempts reached");
    this.name = "NotificationRetryExhaustedError";
  }
}

export class NotificationValidationError extends NotificationError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message);
    this.name = "NotificationValidationError";
  }
}
