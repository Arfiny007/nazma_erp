import type { NotificationChannel } from "@prisma/client";

import type { NotificationProvider } from "../notification-types";
import { ConsoleEmailProvider } from "./console-provider";
import {
  isSmtpConfigured,
  resolveSmtpConfigFromEnv,
  SmtpNotificationProvider,
} from "./smtp-provider";

let cachedEmailProvider: NotificationProvider | null = null;
let cachedSmtpProvider: SmtpNotificationProvider | null = null;

function createEmailProvider(): NotificationProvider {
  const smtpConfig = resolveSmtpConfigFromEnv();
  if (smtpConfig) {
    cachedSmtpProvider = new SmtpNotificationProvider(smtpConfig);
    return cachedSmtpProvider;
  }
  return new ConsoleEmailProvider();
}

export function resolveNotificationProvider(
  channel: NotificationChannel,
): NotificationProvider {
  if (channel === "EMAIL") {
    if (!cachedEmailProvider) {
      cachedEmailProvider = createEmailProvider();
    }
    return cachedEmailProvider;
  }

  if (!cachedEmailProvider) {
    cachedEmailProvider = createEmailProvider();
  }
  return cachedEmailProvider;
}

export function getActiveEmailProviderName(): string {
  return resolveNotificationProvider("EMAIL").name;
}

export async function getEmailProviderHealth(): Promise<{
  provider: string;
  configured: boolean;
  healthy: boolean;
  error?: string;
}> {
  const providerName = getActiveEmailProviderName();

  if (providerName === "smtp" && cachedSmtpProvider) {
    const verification = await cachedSmtpProvider.verifyConnection();
    return {
      provider: providerName,
      configured: true,
      healthy: verification.ok,
      error: verification.error,
    };
  }

  if (providerName === "smtp") {
    return {
      provider: providerName,
      configured: isSmtpConfigured(),
      healthy: false,
      error: "SMTP provider not initialized",
    };
  }

  return {
    provider: providerName,
    configured: true,
    healthy: true,
  };
}

export function resetProviderCache(): void {
  cachedEmailProvider = null;
  cachedSmtpProvider = null;
}

export { ConsoleEmailProvider };
export type { NotificationProvider } from "../notification-types";
