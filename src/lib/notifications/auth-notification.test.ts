import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthNotificationResendForbiddenError,
  AuthNotificationUserNotEligibleError,
} from "@/lib/notifications/auth-notification-errors";
import {
  buildActivationNotificationPayload,
  formatNotificationDate,
  toActivationTemplateVariables,
  toPasswordResetTemplateVariables,
} from "@/lib/notifications/auth-template-mappers";
import { renderNotificationTemplate } from "@/lib/notifications/notification-template-service";
import type { AuthUser } from "@/types/auth";

const mockCreateNotification = vi.fn();
const mockQueueNotification = vi.fn();
const mockGetNotification = vi.fn();
const mockRetryNotification = vi.fn();
const mockSearchNotifications = vi.fn();
const mockRenderTemplateByKey = vi.fn();
const mockUserFindUnique = vi.fn();
const mockTransaction = vi.fn();
const mockAuditCreate = vi.fn();
const mockIssueActivationToken = vi.fn();

vi.mock("@/lib/notifications/notification-service", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
  queueNotification: (...args: unknown[]) => mockQueueNotification(...args),
  getNotification: (...args: unknown[]) => mockGetNotification(...args),
  retryNotification: (...args: unknown[]) => mockRetryNotification(...args),
  searchNotifications: (...args: unknown[]) => mockSearchNotifications(...args),
}));

vi.mock("@/lib/notifications/notification-template-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notifications/notification-template-service")>();
  return {
    ...actual,
    renderTemplateByKey: (...args: unknown[]) => mockRenderTemplateByKey(...args),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    auditLog: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
    },
  },
}));

vi.mock("@/lib/users/user-activation-service", () => ({
  issueActivationToken: (...args: unknown[]) => mockIssueActivationToken(...args),
}));

const superAdmin: AuthUser = {
  id: "admin-1",
  name: "Admin",
  email: "admin@test.local",
  role: "Super_Admin",
  isActive: true,
  mustChangePassword: false,
};

const manager: AuthUser = {
  id: "mgr-1",
  name: "Manager",
  email: "mgr@test.local",
  role: "Manager",
  isActive: true,
  mustChangePassword: false,
};

const notificationRecord = {
  id: "notif-1",
  type: "USER_ACTIVATION" as const,
  channel: "EMAIL" as const,
  status: "SENT" as const,
  recipient: "user@example.com",
  subject: "Activate",
  payload: {},
  retryCount: 0,
  maxRetries: 3,
  sentAt: new Date().toISOString(),
  failedAt: null,
  cancelledAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  attempts: [],
};

describe("auth template mappers", () => {
  it("renders bilingual activation templates", () => {
    const payload = buildActivationNotificationPayload({
      name: "Rahim",
      email: "rahim@example.com",
      activationLink: "https://erp.nazma.local/auth/activate?token=abc",
      expirationAt: new Date("2026-07-20T10:00:00.000Z"),
      locale: "en",
    });

    const en = renderNotificationTemplate(
      "Hello {{name}}, activate via {{link}} before {{date}} — {{company}}",
      toActivationTemplateVariables(payload),
    );
    const bn = renderNotificationTemplate(
      "প্রিয় {{name}}, {{link}} লিংকে {{date}} এর আগে সক্রিয় করুন — {{company}}",
      toActivationTemplateVariables({
        ...payload,
        name: "রহিম",
        expirationDate: formatNotificationDate(
          new Date("2026-07-20T10:00:00.000Z"),
          "bn",
        ),
      }),
    );

    expect(en).toContain("Rahim");
    expect(en).toContain("https://erp.nazma.local");
    expect(bn).toContain("রহিম");
  });

  it("maps password reset placeholders", () => {
    const vars = toPasswordResetTemplateVariables({
      name: "Admin",
      email: "admin@example.com",
      resetLink: "https://erp.nazma.local/auth/reset-password?token=xyz",
      company: "Nazma Water Taps",
      expirationDate: "July 13, 2026 at 11:00 AM",
    });

    expect(vars.link).toContain("reset-password");
    expect(vars.name).toBe("Admin");
  });
});

describe("auth notification dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRenderTemplateByKey.mockResolvedValue({
      subject: "Subject",
      body: "Body",
    });
    mockCreateNotification.mockResolvedValue({ ...notificationRecord, status: "PENDING" });
    mockQueueNotification.mockResolvedValue({ ...notificationRecord, status: "PENDING" });
    mockGetNotification.mockResolvedValue({ ...notificationRecord, status: "PENDING" });
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        auditLog: { create: mockAuditCreate },
        userPasswordResetToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockResolvedValue({ id: "reset-1" }),
        },
      }),
    );
  });

  it("creates activation notification through notification service", async () => {
    const { dispatchActivationNotification } = await import(
      "@/lib/notifications/auth-notifications"
    );

    const result = await dispatchActivationNotification({
      actorId: "admin-1",
      userId: "user-1",
      name: "Rahim",
      email: "user@example.com",
      activationLink: "https://erp.nazma.local/auth/activate?token=abc",
      expirationAt: new Date("2026-07-20T10:00:00.000Z"),
    });

    expect(result.status).toBe("PENDING");
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "USER_ACTIVATION",
        channel: "EMAIL",
        recipient: "user@example.com",
      }),
      "admin-1",
    );
    expect(mockQueueNotification).toHaveBeenCalled();
    expect(mockGetNotification).toHaveBeenCalledWith("notif-1");
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "USER_ACTIVATION_STARTED" }),
      }),
    );
  });

  it("creates password reset notification through notification service", async () => {
    const { dispatchPasswordResetNotification } = await import(
      "@/lib/notifications/auth-notifications"
    );

    await dispatchPasswordResetNotification({
      actorId: "user-1",
      userId: "user-1",
      name: "Rahim",
      email: "user@example.com",
      resetLink: "https://erp.nazma.local/auth/reset-password?token=abc",
      expirationAt: new Date("2026-07-13T11:00:00.000Z"),
    });

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PASSWORD_RESET",
        channel: "EMAIL",
      }),
      "user-1",
    );
    expect(mockQueueNotification).toHaveBeenCalled();
    expect(mockGetNotification).toHaveBeenCalled();
  });
});

describe("auth notification resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRenderTemplateByKey.mockResolvedValue({ subject: "Subject", body: "Body" });
    mockCreateNotification.mockResolvedValue({ ...notificationRecord, status: "PENDING" });
    mockQueueNotification.mockResolvedValue({ ...notificationRecord, status: "PENDING" });
    mockGetNotification.mockResolvedValue({ ...notificationRecord, status: "PENDING" });
    mockSearchNotifications.mockResolvedValue({ records: [], total: 0, page: 1, pageSize: 1, totalPages: 1 });
    mockIssueActivationToken.mockResolvedValue("plain-token");
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        auditLog: { create: mockAuditCreate },
        userPasswordResetToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockResolvedValue({ id: "reset-1" }),
        },
      }),
    );
  });

  it("blocks non-super-admin resend", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      name: "Rahim",
      email: "user@example.com",
      lifecycleStatus: "PENDING_ACTIVATION",
    });

    const { resendActivationNotification } = await import(
      "@/lib/notifications/auth-notifications"
    );

    await expect(resendActivationNotification(manager, "user-1")).rejects.toThrow(
      AuthNotificationResendForbiddenError,
    );
  });

  it("rejects disabled users for activation resend", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      name: "Rahim",
      email: "user@example.com",
      lifecycleStatus: "DISABLED",
    });

    const { resendActivationNotification } = await import(
      "@/lib/notifications/auth-notifications"
    );

    await expect(resendActivationNotification(superAdmin, "user-1")).rejects.toThrow(
      AuthNotificationUserNotEligibleError,
    );
  });

  it("reuses retryNotification for failed activation delivery", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      name: "Rahim",
      email: "user@example.com",
      lifecycleStatus: "PENDING_ACTIVATION",
    });
    mockSearchNotifications.mockResolvedValue({
      records: [{ ...notificationRecord, status: "FAILED", retryCount: 1 }],
      total: 1,
      page: 1,
      pageSize: 1,
      totalPages: 1,
    });
    mockRetryNotification.mockResolvedValue(notificationRecord);

    const { resendActivationNotification } = await import(
      "@/lib/notifications/auth-notifications"
    );

    await resendActivationNotification(superAdmin, "user-1");

    expect(mockRetryNotification).toHaveBeenCalledWith("notif-1", "admin-1");
    expect(mockIssueActivationToken).not.toHaveBeenCalled();
  });

  it("issues fresh reset token when no retriable notification exists", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      name: "Rahim",
      email: "user@example.com",
      lifecycleStatus: "ACTIVE",
      isActive: true,
    });

    const { resendPasswordResetNotification } = await import(
      "@/lib/notifications/auth-notifications"
    );

    await resendPasswordResetNotification(superAdmin, "user-1");

    expect(mockCreateNotification).toHaveBeenCalled();
    expect(mockRetryNotification).not.toHaveBeenCalled();
  });

  it("rejects archived users for password reset resend", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      name: "Rahim",
      email: "user@example.com",
      lifecycleStatus: "ARCHIVED",
      isActive: false,
    });

    const { resendPasswordResetNotification } = await import(
      "@/lib/notifications/auth-notifications"
    );

    await expect(resendPasswordResetNotification(superAdmin, "user-1")).rejects.toThrow(
      AuthNotificationUserNotEligibleError,
    );
  });
});
