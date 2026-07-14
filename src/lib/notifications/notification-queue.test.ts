import { describe, expect, it } from "vitest";

import {
  computeNextRetryAt,
  isEligibleForProcessing,
} from "@/lib/notifications/worker/notification-scheduler";

describe("notification scheduler", () => {
  const base = new Date("2026-07-13T10:00:00.000Z");

  it("schedules attempt 2 at +5 minutes", () => {
    const next = computeNextRetryAt(1, 3, base);
    expect(next?.toISOString()).toBe("2026-07-13T10:05:00.000Z");
  });

  it("schedules attempt 3 at +30 minutes", () => {
    const next = computeNextRetryAt(2, 3, base);
    expect(next?.toISOString()).toBe("2026-07-13T10:30:00.000Z");
  });

  it("returns null when retries exhausted", () => {
    expect(computeNextRetryAt(3, 3, base)).toBeNull();
  });

  it("evaluates processing eligibility", () => {
    const now = new Date("2026-07-13T10:00:00.000Z");
    expect(isEligibleForProcessing("PENDING", null, now)).toBe(true);
    expect(
      isEligibleForProcessing("PENDING", new Date("2026-07-13T09:00:00.000Z"), now),
    ).toBe(true);
    expect(
      isEligibleForProcessing("PENDING", new Date("2026-07-13T11:00:00.000Z"), now),
    ).toBe(false);
    expect(
      isEligibleForProcessing("FAILED", new Date("2026-07-13T09:00:00.000Z"), now),
    ).toBe(true);
    expect(isEligibleForProcessing("SENT", null, now)).toBe(false);
  });
});

describe("notification queue batch helpers", () => {
  it("normalizes batch size bounds", async () => {
    const { normalizeBatchSize } = await import(
      "@/lib/notifications/worker/notification-batch"
    );
    expect(normalizeBatchSize()).toBe(25);
    expect(normalizeBatchSize(10)).toBe(10);
    expect(normalizeBatchSize(500)).toBe(100);
    expect(normalizeBatchSize(0)).toBe(25);
  });
});
