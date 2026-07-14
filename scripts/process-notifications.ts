#!/usr/bin/env tsx
/**
 * Database-backed notification queue worker.
 * Safe to run manually or on a schedule inside Docker.
 *
 * Usage:
 *   npx tsx scripts/process-notifications.ts
 *   NOTIFICATION_WORKER_ACTOR_ID=<userId> npx tsx scripts/process-notifications.ts
 */

import { prisma } from "../src/lib/prisma";
import { processPendingNotifications } from "../src/lib/notifications/worker/notification-worker";

const DEFAULT_BATCH_SIZE = 25;

async function resolveWorkerActorId(): Promise<string> {
  const fromEnv = process.env.NOTIFICATION_WORKER_ACTOR_ID?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const admin = await prisma.user.findFirst({
    where: { role: "Super_Admin", isActive: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (!admin) {
    throw new Error(
      "No active Super_Admin user found. Set NOTIFICATION_WORKER_ACTOR_ID.",
    );
  }

  return admin.id;
}

async function main(): Promise<void> {
  const batchSizeRaw = process.env.NOTIFICATION_BATCH_SIZE?.trim();
  const batchSize = batchSizeRaw
    ? Number.parseInt(batchSizeRaw, 10)
    : DEFAULT_BATCH_SIZE;

  const actorId = await resolveWorkerActorId();
  const result = await processPendingNotifications(actorId, batchSize);

  console.info(
    `[process-notifications] claimed=${result.claimed} sent=${result.sent} failed=${result.failed} paused=${result.paused} skipped=${result.skipped}`,
  );
}

main()
  .catch((error) => {
    console.error("[process-notifications] fatal error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
