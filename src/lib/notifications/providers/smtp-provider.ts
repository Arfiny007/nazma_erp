import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import type {
  NotificationDeliveryResult,
  NotificationPayload,
  NotificationProvider,
} from "../notification-types";

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  timeoutMs: number;
}

const DEFAULT_SMTP_TIMEOUT_MS = 30_000;

export function resolveSmtpConfigFromEnv(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const username = process.env.SMTP_USERNAME?.trim() ?? "";
  const password = process.env.SMTP_PASSWORD?.trim() ?? "";
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim();
  const fromName = process.env.SMTP_FROM_NAME?.trim() ?? "Nazma ERP";

  if (!host || !fromEmail) {
    return null;
  }

  const port = portRaw ? Number.parseInt(portRaw, 10) : 587;
  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }

  const timeoutRaw = process.env.SMTP_TIMEOUT_MS?.trim();
  const timeoutMs = timeoutRaw
    ? Number.parseInt(timeoutRaw, 10)
    : DEFAULT_SMTP_TIMEOUT_MS;

  return {
    host,
    port,
    username,
    password,
    fromEmail,
    fromName,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_SMTP_TIMEOUT_MS,
  };
}

export function isSmtpConfigured(): boolean {
  return resolveSmtpConfigFromEnv() !== null;
}

function buildFromAddress(config: SmtpConfig): string {
  if (config.fromName) {
    return `"${config.fromName}" <${config.fromEmail}>`;
  }
  return config.fromEmail;
}

export class SmtpNotificationProvider implements NotificationProvider {
  readonly name = "smtp";

  private readonly config: SmtpConfig;
  private transporter: Transporter | null = null;

  constructor(config: SmtpConfig) {
    this.config = config;
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.port === 465,
        auth: this.config.username
          ? {
              user: this.config.username,
              pass: this.config.password,
            }
          : undefined,
        connectionTimeout: this.config.timeoutMs,
        greetingTimeout: this.config.timeoutMs,
        socketTimeout: this.config.timeoutMs,
      });
    }
    return this.transporter;
  }

  async send(payload: NotificationPayload): Promise<NotificationDeliveryResult> {
    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: buildFromAddress(this.config),
        to: payload.recipient,
        subject: payload.subject ?? "(no subject)",
        text: payload.body,
      });

      return {
        success: true,
        provider: this.name,
        messageId: info.messageId ?? undefined,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown SMTP delivery error";
      return {
        success: false,
        provider: this.name,
        error: message,
      };
    }
  }

  async verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.getTransporter().verify();
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "SMTP verification failed";
      return { ok: false, error: message };
    }
  }
}
