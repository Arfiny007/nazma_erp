import type {
  NotificationDeliveryResult,
  NotificationPayload,
  NotificationProvider,
} from "../notification-types";

export class ConsoleEmailProvider implements NotificationProvider {
  readonly name = "console-email";

  async send(payload: NotificationPayload): Promise<NotificationDeliveryResult> {
    console.info(
      `[ConsoleEmailProvider] notification=${payload.notificationId} to=${payload.recipient} subject=${payload.subject ?? "(none)"}`,
    );
    console.info(`[ConsoleEmailProvider] body:\n${payload.body}`);

    return {
      success: true,
      provider: this.name,
      messageId: `console-${payload.notificationId}`,
    };
  }
}
