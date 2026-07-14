import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConsoleEmailProvider } from "@/lib/notifications/providers/console-provider";
import {
  getActiveEmailProviderName,
  resetProviderCache,
} from "@/lib/notifications/providers/provider-factory";

const mockIsQueuePaused = vi.fn();
const mockClaimNotificationBatch = vi.fn();
const mockRecordQueueProcessedAt = vi.fn();
const mockProviderSend = vi.fn();
const mockNotificationUpdate = vi.fn();
const mockAttemptCreate = vi.fn();
const mockAuditCreate = vi.fn();
const mockTransaction = vi.fn();
const mockAuditLogCreate = vi.fn();

vi.mock("@/lib/notifications/worker/notification-queue-config", () => ({
  isQueuePaused: (...args: unknown[]) => mockIsQueuePaused(...args),
  recordQueueProcessedAt: (...args: unknown[]) => mockRecordQueueProcessedAt(...args),
  getQueueConfig: vi.fn(),
  queryQueueMetrics: vi.fn(),
  queryAverageDeliveryTimeMs: vi.fn(),
  scheduleFailedForRetry: vi.fn(),
  setQueuePaused: vi.fn(),
  recordBatchRetriedAudit: vi.fn(),
}));

vi.mock("@/lib/notifications/worker/notification-batch", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/notifications/worker/notification-batch")
  >();
  return {
    ...actual,
    claimNotificationBatch: (...args: unknown[]) => mockClaimNotificationBatch(...args),
  };
});

vi.mock("@/lib/notifications/providers/provider-factory", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/notifications/providers/provider-factory")
  >();
  return {
    ...actual,
    resolveNotificationProvider: () => ({
      name: "console-email",
      send: (...args: unknown[]) => mockProviderSend(...args),
    }),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      update: (...args: unknown[]) => mockNotificationUpdate(...args),
    },
    notificationDeliveryAttempt: {
      create: (...args: unknown[]) => mockAttemptCreate(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const ACTOR_ID = "admin-1";

const claimedNotification = {
  id: "notif-1",
  type: "USER_ACTIVATION" as const,
  channel: "EMAIL" as const,
  status: "PROCESSING" as const,
  recipient: "user@example.com",
  subject: "Activate",
  payload: { body: "Hello" },
  retryCount: 0,
  maxRetries: 3,
};

describe("ConsoleEmailProvider", () => {
  it("returns success with message id", async () => {
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
    expect(result.messageId).toContain("console-");
    infoSpy.mockRestore();
  });
});

describe("provider factory", () => {
  beforeEach(() => {
    resetProviderCache();
    vi.unstubAllEnvs();
  });

  it("defaults to console provider without SMTP env", () => {
    expect(getActiveEmailProviderName()).toBe("console-email");
  });
});

describe("notification worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsQueuePaused.mockResolvedValue(false);
    mockRecordQueueProcessedAt.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        notificationDeliveryAttempt: { create: mockAttemptCreate },
        notification: { update: mockNotificationUpdate },
        auditLog: { create: mockAuditCreate },
      }),
    );
    mockAuditLogCreate.mockResolvedValue({});
  });

  it("skips processing when queue is paused", async () => {
    mockIsQueuePaused.mockResolvedValue(true);
    const { processPendingNotifications } = await import(
      "@/lib/notifications/worker/notification-worker"
    );

    const result = await processPendingNotifications(ACTOR_ID);
    expect(result.skipped).toBe(true);
    expect(result.paused).toBe(true);
    expect(mockClaimNotificationBatch).not.toHaveBeenCalled();
  });

  it("delivers claimed notifications and records audit", async () => {
    mockClaimNotificationBatch.mockResolvedValue([claimedNotification]);
    mockProviderSend.mockResolvedValue({
      success: true,
      provider: "console-email",
      messageId: "msg-1",
    });

    const { processPendingNotifications } = await import(
      "@/lib/notifications/worker/notification-worker"
    );

    const result = await processPendingNotifications(ACTOR_ID, 10);
    expect(result.claimed).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockProviderSend).toHaveBeenCalled();
    expect(mockAttemptCreate).toHaveBeenCalled();
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "NOTIFICATION_PROVIDER_SENT" }),
      }),
    );
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "NOTIFICATION_QUEUE_PROCESSED" }),
      }),
    );
  });

  it("schedules retry on provider failure", async () => {
    mockClaimNotificationBatch.mockResolvedValue([claimedNotification]);
    mockProviderSend.mockResolvedValue({
      success: false,
      provider: "console-email",
      error: "SMTP timeout",
    });

    const { processPendingNotifications } = await import(
      "@/lib/notifications/worker/notification-worker"
    );

    const result = await processPendingNotifications(ACTOR_ID);
    expect(result.failed).toBe(1);
    expect(mockNotificationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING",
          retryCount: 1,
          nextRetryAt: expect.any(Date),
        }),
      }),
    );
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "NOTIFICATION_PROVIDER_FAILED" }),
      }),
    );
  });
});
