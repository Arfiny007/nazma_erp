import type { NotificationChannel, NotificationType, UserLifecycleStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordUserAudit } from "@/lib/users/user-audit";
import { issueActivationToken } from "@/lib/users/user-activation-service";
import {
  ACTIVATION_TOKEN_TTL_MS,
  buildActivationUrl,
  buildPasswordResetUrl,
  generateSecureToken,
  hashToken,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from "@/lib/users/user-tokens";
import type { AuthUser } from "@/types/auth";
import type { Locale } from "@/types/locale";
import { DEFAULT_LOCALE } from "@/types/locale";

import {
  AuthNotificationChannelUnsupportedError,
  AuthNotificationResendForbiddenError,
  AuthNotificationUserNotEligibleError,
} from "./auth-notification-errors";
import {
  buildActivationNotificationPayload,
  buildPasswordResetNotificationPayload,
  toActivationTemplateVariables,
  toPasswordResetTemplateVariables,
} from "./auth-template-mappers";
import {
  createNotification,
  getNotification,
  queueNotification,
  retryNotification,
  searchNotifications,
} from "./notification-service";
import { renderTemplateByKey } from "./notification-template-service";
import type { NotificationRecord } from "./notification-types";

const ACTIVATION_TEMPLATE_KEY = "USER_ACTIVATION_EMAIL";
const PASSWORD_RESET_TEMPLATE_KEY = "PASSWORD_RESET_EMAIL";
const SUPPORTED_AUTH_CHANNELS = new Set<NotificationChannel>(["EMAIL"]);

const ACTIVATABLE_STATUSES = new Set<UserLifecycleStatus>([
  "INVITED",
  "PENDING_ACTIVATION",
]);

const BLOCKED_STATUSES = new Set<UserLifecycleStatus>(["DISABLED", "ARCHIVED"]);

function assertAuthChannel(channel: NotificationChannel): void {
  if (!SUPPORTED_AUTH_CHANNELS.has(channel)) {
    throw new AuthNotificationChannelUnsupportedError(channel);
  }
}

function assertSuperAdminResend(actor: AuthUser): void {
  if (actor.role !== "Super_Admin") {
    throw new AuthNotificationResendForbiddenError();
  }
}

function assertActivationEligible(lifecycleStatus: UserLifecycleStatus): void {
  if (BLOCKED_STATUSES.has(lifecycleStatus)) {
    throw new AuthNotificationUserNotEligibleError(
      "Disabled or archived users cannot receive activation notifications",
    );
  }
  if (!ACTIVATABLE_STATUSES.has(lifecycleStatus)) {
    throw new AuthNotificationUserNotEligibleError(
      "User is not eligible for activation notification",
    );
  }
}

function assertPasswordResetEligible(
  lifecycleStatus: UserLifecycleStatus,
  isActive: boolean,
): void {
  if (BLOCKED_STATUSES.has(lifecycleStatus)) {
    throw new AuthNotificationUserNotEligibleError(
      "Disabled or archived users cannot receive password reset notifications",
    );
  }
  if (!isActive || lifecycleStatus !== "ACTIVE") {
    throw new AuthNotificationUserNotEligibleError(
      "Only active users may receive password reset notifications",
    );
  }
}

async function dispatchAuthEmailNotification(params: {
  actorId: string;
  targetUserId: string;
  type: NotificationType;
  templateKey: string;
  recipient: string;
  subject: string;
  body: string;
  payload: Record<string, unknown>;
}): Promise<NotificationRecord> {
  const channel: NotificationChannel = "EMAIL";
  assertAuthChannel(channel);

  const created = await createNotification(
    {
      type: params.type,
      channel,
      recipient: params.recipient,
      subject: params.subject,
      payload: {
        ...params.payload,
        body: params.body,
        userId: params.targetUserId,
      },
    },
    params.actorId,
  );

  if (params.type === "USER_ACTIVATION") {
    await prisma.$transaction(async (tx) => {
      await recordUserAudit(tx, {
        actorId: params.actorId,
        targetUserId: params.targetUserId,
        action: "USER_ACTIVATION_STARTED",
        newValue: {
          notificationId: created.id,
          recipient: params.recipient,
        },
      });
    });
  }

  await queueNotification(created.id);
  return getNotification(created.id);
}

export async function dispatchActivationNotification(params: {
  actorId: string;
  userId: string;
  name: string;
  email: string;
  activationLink: string;
  expirationAt: Date;
  locale?: Locale;
}): Promise<NotificationRecord> {
  const locale = params.locale ?? DEFAULT_LOCALE;
  const payload = buildActivationNotificationPayload({
    name: params.name,
    email: params.email,
    activationLink: params.activationLink,
    expirationAt: params.expirationAt,
    locale,
  });

  const rendered = await renderTemplateByKey(
    ACTIVATION_TEMPLATE_KEY,
    locale,
    "EMAIL",
    toActivationTemplateVariables(payload),
  );

  return dispatchAuthEmailNotification({
    actorId: params.actorId,
    targetUserId: params.userId,
    type: "USER_ACTIVATION",
    templateKey: ACTIVATION_TEMPLATE_KEY,
    recipient: params.email,
    subject: rendered.subject,
    body: rendered.body,
    payload: {
      name: payload.name,
      email: payload.email,
      activationLink: payload.activationLink,
      company: payload.company,
      expirationDate: payload.expirationDate,
      templateKey: ACTIVATION_TEMPLATE_KEY,
      locale,
    },
  });
}

export async function dispatchPasswordResetNotification(params: {
  actorId: string;
  userId: string;
  name: string;
  email: string;
  resetLink: string;
  expirationAt: Date;
  locale?: Locale;
}): Promise<NotificationRecord> {
  const locale = params.locale ?? DEFAULT_LOCALE;
  const payload = buildPasswordResetNotificationPayload({
    name: params.name,
    email: params.email,
    resetLink: params.resetLink,
    expirationAt: params.expirationAt,
    locale,
  });

  const rendered = await renderTemplateByKey(
    PASSWORD_RESET_TEMPLATE_KEY,
    locale,
    "EMAIL",
    toPasswordResetTemplateVariables(payload),
  );

  return dispatchAuthEmailNotification({
    actorId: params.actorId,
    targetUserId: params.userId,
    type: "PASSWORD_RESET",
    templateKey: PASSWORD_RESET_TEMPLATE_KEY,
    recipient: params.email,
    subject: rendered.subject,
    body: rendered.body,
    payload: {
      name: payload.name,
      email: payload.email,
      resetLink: payload.resetLink,
      company: payload.company,
      expirationDate: payload.expirationDate,
      templateKey: PASSWORD_RESET_TEMPLATE_KEY,
      locale,
    },
  });
}

async function findLatestRetriableNotification(
  recipient: string,
  type: NotificationType,
): Promise<NotificationRecord | null> {
  const result = await searchNotifications({
    page: 1,
    pageSize: 1,
    recipient,
    type,
    status: "FAILED",
  });

  return result.records[0] ?? null;
}

async function resendViaRetryOrDispatch(params: {
  actor: AuthUser;
  recipient: string;
  type: NotificationType;
  dispatch: () => Promise<NotificationRecord>;
}): Promise<NotificationRecord> {
  const failed = await findLatestRetriableNotification(params.recipient, params.type);
  if (failed && failed.retryCount < failed.maxRetries) {
    return retryNotification(failed.id, params.actor.id);
  }
  return params.dispatch();
}

export async function resendActivationNotification(
  actor: AuthUser,
  userId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<NotificationRecord> {
  assertSuperAdminResend(actor);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      lifecycleStatus: true,
    },
  });

  if (!user) {
    throw new AuthNotificationUserNotEligibleError("User not found");
  }

  assertActivationEligible(user.lifecycleStatus);

  return resendViaRetryOrDispatch({
    actor,
    recipient: user.email,
    type: "USER_ACTIVATION",
    dispatch: async () => {
      let plainToken = "";
      await prisma.$transaction(async (tx) => {
        plainToken = await issueActivationToken(tx, user.id);
      });

      const expirationAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);
      return dispatchActivationNotification({
        actorId: actor.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        activationLink: buildActivationUrl(plainToken),
        expirationAt,
        locale,
      });
    },
  });
}

export async function resendPasswordResetNotification(
  actor: AuthUser,
  userId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<NotificationRecord> {
  assertSuperAdminResend(actor);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      lifecycleStatus: true,
      isActive: true,
    },
  });

  if (!user) {
    throw new AuthNotificationUserNotEligibleError("User not found");
  }

  assertPasswordResetEligible(user.lifecycleStatus, user.isActive);

  return resendViaRetryOrDispatch({
    actor,
    recipient: user.email,
    type: "PASSWORD_RESET",
    dispatch: async () => {
      const plainToken = generateSecureToken();
      const tokenHash = hashToken(plainToken);
      const expirationAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

      await prisma.$transaction(async (tx) => {
        await tx.userPasswordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });

        await tx.userPasswordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt: expirationAt,
          },
        });

        await recordUserAudit(tx, {
          actorId: actor.id,
          targetUserId: user.id,
          action: "USER_PASSWORD_RESET_REQUESTED",
          newValue: { email: user.email, resentByAdmin: true },
        });
      });

      return dispatchPasswordResetNotification({
        actorId: actor.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        resetLink: buildPasswordResetUrl(plainToken),
        expirationAt,
        locale,
      });
    },
  });
}

export async function getAuthNotificationById(
  notificationId: string,
): Promise<NotificationRecord> {
  return getNotification(notificationId);
}
