import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NOTIFICATION_AUDIT_ENTITY_TYPE,
  NotificationLifecycleError,
  NotificationRetryExhaustedError,
  assertNotificationTransition,
  canRetryNotification,
  renderNotificationTemplate,
} from "@/lib/notifications";
import { ConsoleEmailProvider } from "@/lib/notifications/providers/console-provider";

const mockNotificationCreate = vi.fn();
const mockNotificationUpdate = vi.fn();
const mockNotificationFindUnique = vi.fn();
const mockNotificationCount = vi.fn();
const mockNotificationFindMany = vi.fn();
const mockAttemptCreate = vi.fn();
const mockAuditCreate = vi.fn();
const mockTemplateFindUnique = vi.fn();
const mockTemplateCount = vi.fn();
const mockTemplateFindMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      create: (...args: unknown[]) => mockNotificationCreate(...args),
      update: (...args: unknown[]) => mockNotificationUpdate(...args),
      findUnique: (...args: unknown[]) => mockNotificationFindUnique(...args),
      count: (...args: unknown[]) => mockNotificationCount(...args),
      findMany: (...args: unknown[]) => mockNotificationFindMany(...args),
    },
    notificationDeliveryAttempt: {
      create: (...args: unknown[]) => mockAttemptCreate(...args),
    },
    notificationTemplate: {
      findUnique: (...args: unknown[]) => mockTemplateFindUnique(...args),
      count: (...args: unknown[]) => mockTemplateCount(...args),
      findMany: (...args: unknown[]) => mockTemplateFindMany(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const ACTOR_ID = "admin-1";
const NOW = new Date("2026-07-13T10:00:00.000Z");

function buildNotificationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "notif-1",
    type: "USER_ACTIVATION",
    channel: "EMAIL",
    status: "PENDING",
    recipient: "user@example.com",
    subject: "Activate account",
    payload: { body: "Hello {{name}}" },
    retryCount: 0,
    maxRetries: 3,
    queuedAt: null,
    processingStartedAt: null,
    nextRetryAt: null,
    lastAttemptAt: null,
    provider: null,
    providerMessageId: null,
    sentAt: null,
    failedAt: null,
    cancelledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    attempts: [],
    ...overrides,
  };
}

describe("notification lifecycle", () => {
  it("allows valid transitions", () => {
    expect(() => assertNotificationTransition("PENDING", "PROCESSING")).not.toThrow();
    expect(() => assertNotificationTransition("PROCESSING", "SENT")).not.toThrow();
    expect(() => assertNotificationTransition("PROCESSING", "FAILED")).not.toThrow();
    expect(() => assertNotificationTransition("FAILED", "PROCESSING")).not.toThrow();
    expect(() => assertNotificationTransition("PENDING", "CANCELLED")).not.toThrow();
  });

  it("rejects illegal transitions", () => {
    expect(() => assertNotificationTransition("SENT", "PENDING")).toThrow(
      NotificationLifecycleError,
    );
    expect(() => assertNotificationTransition("CANCELLED", "PROCESSING")).toThrow(
      NotificationLifecycleError,
    );
  });

  it("evaluates retry eligibility", () => {
    expect(canRetryNotification("FAILED", 1, 3)).toBe(true);
    expect(canRetryNotification("FAILED", 3, 3)).toBe(false);
    expect(canRetryNotification("PENDING", 0, 3)).toBe(false);
  });
});

describe("notification template rendering", () => {
  it("replaces placeholders", () => {
    const rendered = renderNotificationTemplate(
      "Hello {{name}}, visit {{link}} on {{date}} — {{company}}",
      {
        name: "Rahim",
        link: "https://example.com",
        date: "2026-07-13",
        company: "Nazma Metal Industries",
      },
    );

    expect(rendered).toContain("Rahim");
    expect(rendered).toContain("https://example.com");
    expect(rendered).toContain("Nazma Metal Industries");
  });

  it("supports bilingual template bodies", () => {
    const en = renderNotificationTemplate("Welcome {{name}}", { name: "Admin" });
    const bn = renderNotificationTemplate("স্বাগতম {{name}}", { name: "অ্যাডমিন" });
    expect(en).toBe("Welcome Admin");
    expect(bn).toBe("স্বাগতম অ্যাডমিন");
  });
});

describe("ConsoleEmailProvider", () => {
  it("logs and returns success without external calls", async () => {
    const provider = new ConsoleEmailProvider();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const result = await provider.send({
      notificationId: "notif-1",
      type: "SYSTEM",
      channel: "EMAIL",
      recipient: "ops@nazma.local",
      subject: "Test",
      body: "Body",
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe("console-email");
    expect(infoSpy).toHaveBeenCalled();
    infoSpy.mockRestore();
  });
});

describe("notification service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        notification: {
          create: mockNotificationCreate,
          update: mockNotificationUpdate,
        },
        notificationDeliveryAttempt: {
          create: mockAttemptCreate,
        },
        auditLog: {
          create: mockAuditCreate,
        },
      }),
    );
  });

  it("creates a notification and writes audit", async () => {
    mockNotificationCreate.mockResolvedValue({ id: "notif-1" });
    mockNotificationFindUnique.mockResolvedValue(buildNotificationRow());

    const { createNotification } = await import("@/lib/notifications/notification-service");
    const record = await createNotification(
      {
        type: "USER_ACTIVATION",
        channel: "EMAIL",
        recipient: "user@example.com",
        payload: { body: "Hello" },
      },
      ACTOR_ID,
    );

    expect(record.id).toBe("notif-1");
    expect(mockNotificationCreate).toHaveBeenCalled();
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "NOTIFICATION_CREATED",
          entityType: NOTIFICATION_AUDIT_ENTITY_TYPE,
        }),
      }),
    );
  });

  it("sends via provider and records delivery attempt", async () => {
    mockNotificationFindUnique
      .mockResolvedValueOnce(buildNotificationRow())
      .mockResolvedValueOnce(buildNotificationRow({ status: "SENT", sentAt: NOW }));

    const { sendNotification } = await import("@/lib/notifications/notification-service");
    const record = await sendNotification("notif-1", ACTOR_ID);

    expect(record.status).toBe("SENT");
    expect(mockAttemptCreate).toHaveBeenCalled();
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "NOTIFICATION_SENT" }),
      }),
    );
  });

  it("cancels pending notifications", async () => {
    mockNotificationFindUnique
      .mockResolvedValueOnce(buildNotificationRow())
      .mockResolvedValueOnce(buildNotificationRow({ status: "CANCELLED", cancelledAt: NOW }));

    const { cancelNotification } = await import("@/lib/notifications/notification-service");
    const record = await cancelNotification("notif-1", ACTOR_ID);

    expect(record.status).toBe("CANCELLED");
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "NOTIFICATION_CANCELLED" }),
      }),
    );
  });

  it("retries failed notifications when under max retries", async () => {
    mockNotificationFindUnique
      .mockResolvedValueOnce(buildNotificationRow({ status: "FAILED", retryCount: 1 }))
      .mockResolvedValueOnce(buildNotificationRow({ status: "PROCESSING" }))
      .mockResolvedValueOnce(buildNotificationRow({ status: "SENT", sentAt: NOW }));

    const { retryNotification } = await import("@/lib/notifications/notification-service");
    const record = await retryNotification("notif-1", ACTOR_ID);

    expect(record.status).toBe("SENT");
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "NOTIFICATION_RETRIED" }),
      }),
    );
  });

  it("blocks retry when exhausted", async () => {
    mockNotificationFindUnique.mockResolvedValue(
      buildNotificationRow({ status: "FAILED", retryCount: 3, maxRetries: 3 }),
    );

    const { retryNotification } = await import("@/lib/notifications/notification-service");
    await expect(retryNotification("notif-1", ACTOR_ID)).rejects.toThrow(
      NotificationRetryExhaustedError,
    );
  });
});

describe("notification search filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
    mockNotificationCount.mockResolvedValue(1);
    mockNotificationFindMany.mockResolvedValue([buildNotificationRow()]);
  });

  it("applies indexed filters with pagination", async () => {
    const { searchNotifications } = await import("@/lib/notifications/notification-service");

    const result = await searchNotifications({
      page: 1,
      pageSize: 25,
      status: "PENDING",
      recipient: "user@",
    });

    expect(result.total).toBe(1);
    expect(mockNotificationCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING",
          recipient: expect.objectContaining({ contains: "user@" }),
        }),
      }),
    );
    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 25 }),
    );
  });
});
