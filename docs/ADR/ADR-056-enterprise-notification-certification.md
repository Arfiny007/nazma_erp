# ADR-056: Enterprise Notification Certification

**Status:** Accepted  
**Date:** 2026-07-13  
**Phase:** PHASE_11D

## Context

PHASE_11A delivered notification foundation (models, lifecycle, templates, audit). PHASE_11B wired authentication flows into the notification engine. PHASE_11C added SMTP provider abstraction, database-backed queue worker, retry scheduling, and operations UI. Before PHASE_12 development, the notification layer must be certified read-only for immutability, queue integrity, provider isolation, authentication integration, security, financial boundaries, architecture, audit completeness, and performance.

## Decision

### Certification module: `src/lib/certification/notifications/`

| File | Purpose |
|------|---------|
| `notification-certification-service.ts` | `runNotificationCertification()`, `runNotificationCertificationWithReport()` |
| `notification-certification-validation.ts` | Rules 1–12 + repository scans |
| `notification-certification-types.ts` | Result contract, `NotificationAuditCoverageReport` |
| `notification-certification-errors.ts` | Typed certification errors |
| `notification-certification-report.ts` | Executive summary formatting |
| `notification-certification.test.ts` | Certification tests |

### Rules certified

| Rule | Scope |
|------|-------|
| 1 | Notification immutability — `NotificationDeliveryAttempt` append-only; retries create new rows |
| 2 | Queue integrity — lifecycle transitions guarded; illegal paths rejected |
| 3 | Retry policy — immediate → +5m → +30m → permanent FAILED at `maxRetries=3` |
| 4 | Provider isolation — auth/user modules never import nodemailer or call providers directly |
| 5 | Authentication integration — activation and password reset audit chains |
| 6 | Notification security — disabled/archived rejection; resend Super_Admin only; action permissions |
| 7 | Queue safety — `FOR UPDATE SKIP LOCKED`, stale recovery, idempotency, worker script |
| 8 | SMTP abstraction — provider factory; console fallback; nodemailer isolated |
| 9 | Financial boundary — no posting-service / ledger / due imports |
| 10 | Audit completeness — `NotificationAuditCoverageReport` (10 actions) |
| 11 | Architecture — imports limited to approved dependencies |
| 12 | Performance — structural + optional live DB; 100 rows < 1s, 1000 rows < 5s, bounded page size |

### Coverage report

`NotificationAuditCoverageReport` measures ten notification audit actions:

- `NOTIFICATION_CREATED`, `NOTIFICATION_SENT`, `NOTIFICATION_FAILED`, `NOTIFICATION_RETRIED`, `NOTIFICATION_CANCELLED`
- `NOTIFICATION_PROCESSING_STARTED`, `NOTIFICATION_PROVIDER_SENT`, `NOTIFICATION_PROVIDER_FAILED`
- `NOTIFICATION_QUEUE_PROCESSED`, `NOTIFICATION_BATCH_RETRIED`

### Approval gate

`phase11dApproved: true` when:

- Zero critical failures
- Overall score ≥ 9.0
- Queue integrity, provider architecture, authentication integration, notification security, financial boundary, and architecture subsystems pass

## Non-goals

- Notification feature changes
- SMTP / worker deployment automation
- SMS / push / in-app center
- Modifying certified financial, due, dashboard, or territory engines

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| notification-service (PHASE_11A–11C) | No |
| Auth notification integration (PHASE_11B) | No |
| Queue worker (PHASE_11C) | No |

## Consequences

- `runNotificationCertification()` is the pre-production notification gate
- PHASE_12 development may proceed when `phase11dApproved: true`
- Production email still requires SMTP env vars + scheduled `process-notifications.ts` worker
