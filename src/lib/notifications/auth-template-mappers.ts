import type { Locale } from "@/types/locale";
import { DEFAULT_LOCALE } from "@/types/locale";

import { getCompanyBranding } from "@/lib/documents/company-branding";

import type { NotificationTemplateVariables } from "./notification-types";

export interface ActivationNotificationPayload {
  name: string;
  email: string;
  activationLink: string;
  company: string;
  expirationDate: string;
}

export interface PasswordResetNotificationPayload {
  name: string;
  email: string;
  resetLink: string;
  company: string;
  expirationDate: string;
}

export function formatNotificationDate(date: Date, locale: Locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function resolveAuthNotificationCompany(): string {
  return getCompanyBranding().companyName;
}

export function toActivationTemplateVariables(
  payload: ActivationNotificationPayload,
): NotificationTemplateVariables {
  return {
    name: payload.name,
    link: payload.activationLink,
    company: payload.company,
    date: payload.expirationDate,
  };
}

export function toPasswordResetTemplateVariables(
  payload: PasswordResetNotificationPayload,
): NotificationTemplateVariables {
  return {
    name: payload.name,
    link: payload.resetLink,
    company: payload.company,
    date: payload.expirationDate,
  };
}

export function buildActivationNotificationPayload(params: {
  name: string;
  email: string;
  activationLink: string;
  expirationAt: Date;
  locale?: Locale;
}): ActivationNotificationPayload {
  return {
    name: params.name,
    email: params.email,
    activationLink: params.activationLink,
    company: resolveAuthNotificationCompany(),
    expirationDate: formatNotificationDate(params.expirationAt, params.locale),
  };
}

export function buildPasswordResetNotificationPayload(params: {
  name: string;
  email: string;
  resetLink: string;
  expirationAt: Date;
  locale?: Locale;
}): PasswordResetNotificationPayload {
  return {
    name: params.name,
    email: params.email,
    resetLink: params.resetLink,
    company: resolveAuthNotificationCompany(),
    expirationDate: formatNotificationDate(params.expirationAt, params.locale),
  };
}
