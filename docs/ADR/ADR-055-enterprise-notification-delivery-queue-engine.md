# ADR-055: Enterprise Notification Delivery & Queue Engine

**Status:** Accepted  
**Date:** 2026-07-13  
**Phase:** PHASE_11C

## Context

PHASE_11A delivered notification foundation with `ConsoleEmailProvider` and synchronous delivery placeholder. PHASE_11B wired authentication flows through `createNotification` → `queueNotification` → `sendNotification`. Production requires database-backed queue processing, SMTP delivery, retry scheduling, and operations visibility without Redis/BullMQ.

## Decision

### Delivery flow

```
Application Event → createNotification() → queueNotification()
  → Worker (claimNotificationBatch) → Provider (SMTP | Console) → NotificationDeliveryAttempt
```

Auth flows no longer call `sendNotification` directly — notifications remain `PENDING` until the worker claims them.

### Provider abstraction (`src/lib/notifications/providers/`)

| File | Purpose |
|------|---------|
| `smtp-provider.ts` | Environment-driven SMTP via nodemailer |
| `console-provider.ts` | Dev fallback — log-only delivery |
| `provider-factory.ts` | Resolves provider from `SMTP_HOST` presence |

Environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`.

### Worker module (`src/lib/notifications/worker/`)

| File | Purpose |
|------|---------|
| `notification-worker.ts` | `processPendingNotifications`, metrics |
| `notification-batch.ts` | `claimNotificationBatch`, mark sent/failed |
| `notification-scheduler.ts` | Retry delays (+5m, +30m) |
| `notification-queue-config.ts` | Pause state, metrics queries |

Batch claiming uses `FOR UPDATE SKIP LOCKED` for concurrent worker safety.

### Retry policy

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | +5 minutes |
| 3 | +30 minutes |
| 4 | Permanent FAILED |

Stored in `Notification.nextRetryAt`. Delivery attempts remain append-only.

### Schema (additive)

**Notification** fields: `queuedAt`, `processingStartedAt`, `nextRetryAt`, `lastAttemptAt`, `provider`, `providerMessageId`.

Indexes: `[status, nextRetryAt]`, `[status, createdAt]`.

**NotificationQueueConfig** singleton: `paused`, `lastProcessedAt`.

### Permissions

| Permission | Super_Admin | Accounts |
|------------|-------------|----------|
| `notifications:manage` | ✓ | ✗ |

Queue controls (process, retry failed, pause) require `notifications:manage`.

### Operations UI

`/settings/notifications` extended with queue metrics, delivery health, and Super Admin queue controls.

### Background script

`scripts/process-notifications.ts` — Docker-safe, idempotent, multi-run safe.

### Audit events (operational)

- `NOTIFICATION_PROCESSING_STARTED`
- `NOTIFICATION_PROVIDER_SENT`
- `NOTIFICATION_PROVIDER_FAILED`
- `NOTIFICATION_QUEUE_PROCESSED`
- `NOTIFICATION_BATCH_RETRIED`

## Non-goals (PHASE_11C)

- SMS / push / in-app center
- Redis / BullMQ / RabbitMQ
- Template editor
- Marketing campaigns

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| LedgerEntry / Dealer.currentBalance | No |
| Due / dashboard / territory RBAC | No |
| Authentication token security | No |
| notification-service lifecycle contracts | Extended (retry metadata only) |
| Certification modules | No |

## Consequences

- Production email requires SMTP env vars + scheduled worker or manual queue processing
- Console provider remains default when SMTP is not configured
- Auth notifications are queued asynchronously — worker must run for delivery
- Certified read-only in PHASE_11D (`runNotificationCertification()`); ADR-056
