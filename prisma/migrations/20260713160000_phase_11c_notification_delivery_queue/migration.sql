-- PHASE_11C: Enterprise Notification Delivery & Queue Engine
-- Additive only — queue metadata, indexes, queue config singleton

ALTER TABLE "Notification" ADD COLUMN "queuedAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN "processingStartedAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN "nextRetryAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN "lastAttemptAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN "provider" TEXT;
ALTER TABLE "Notification" ADD COLUMN "providerMessageId" TEXT;

CREATE INDEX "Notification_status_nextRetryAt_idx" ON "Notification"("status", "nextRetryAt");
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

CREATE TABLE "NotificationQueueConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "lastProcessedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationQueueConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "NotificationQueueConfig" ("id", "paused", "updatedAt")
VALUES ('default', false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
