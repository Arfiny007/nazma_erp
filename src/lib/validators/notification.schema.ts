import type { NotificationChannel, NotificationType } from "@prisma/client";
import { z } from "zod";

export const createNotificationSchema = z.object({
  type: z.enum([
    "USER_ACTIVATION",
    "PASSWORD_RESET",
    "FINANCIAL_ALERT",
    "INTEGRITY_ALERT",
    "DUE_REMINDER",
    "SYSTEM",
  ] satisfies NotificationType[]),
  channel: z.enum(["EMAIL", "SMS", "IN_APP"] satisfies NotificationChannel[]),
  recipient: z
    .string()
    .trim()
    .min(1, "notifications.validation.recipientRequired")
    .max(320, "notifications.validation.recipientTooLong"),
  subject: z.string().trim().max(500).optional().nullable(),
  payload: z.record(z.string(), z.unknown()),
  maxRetries: z.number().int().min(0).max(10).optional(),
});

export const notificationSearchSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  status: z
    .enum(["PENDING", "PROCESSING", "SENT", "FAILED", "CANCELLED"])
    .optional(),
  type: z
    .enum([
      "USER_ACTIVATION",
      "PASSWORD_RESET",
      "FINANCIAL_ALERT",
      "INTEGRITY_ALERT",
      "DUE_REMINDER",
      "SYSTEM",
    ])
    .optional(),
  channel: z.enum(["EMAIL", "SMS", "IN_APP"]).optional(),
  recipient: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

export const notificationTemplateSearchSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  key: z.string().trim().optional(),
  locale: z.string().trim().optional(),
  channel: z.enum(["EMAIL", "SMS", "IN_APP"]).optional(),
  search: z.string().trim().optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type NotificationSearchInput = z.infer<typeof notificationSearchSchema>;
export type NotificationTemplateSearchInput = z.infer<
  typeof notificationTemplateSearchSchema
>;
