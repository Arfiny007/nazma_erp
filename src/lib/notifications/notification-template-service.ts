import type { NotificationChannel } from "@prisma/client";

import { NotificationTemplateNotFoundError } from "./notification-errors";
import {
  queryTemplateByKey,
  queryTemplates,
} from "./notification-query";
import type {
  NotificationTemplateRecord,
  NotificationTemplateSearchFilters,
  NotificationTemplateVariables,
  PaginatedNotificationTemplates,
} from "./notification-types";

const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;

export function renderNotificationTemplate(
  template: string,
  variables: NotificationTemplateVariables,
): string {
  return template.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    return variables[key as keyof NotificationTemplateVariables] ?? "";
  });
}

export async function getTemplate(
  key: string,
  locale: string,
  channel: NotificationChannel,
): Promise<NotificationTemplateRecord> {
  const template = await queryTemplateByKey(key, locale, channel);
  if (!template) {
    throw new NotificationTemplateNotFoundError();
  }
  return template;
}

export async function searchTemplates(
  filters: NotificationTemplateSearchFilters,
): Promise<PaginatedNotificationTemplates> {
  return queryTemplates(filters);
}

export async function renderTemplateByKey(
  key: string,
  locale: string,
  channel: NotificationChannel,
  variables: NotificationTemplateVariables,
): Promise<{ subject: string; body: string }> {
  const template = await getTemplate(key, locale, channel);
  return {
    subject: renderNotificationTemplate(template.subject, variables),
    body: renderNotificationTemplate(template.body, variables),
  };
}
