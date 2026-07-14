# ADR-053: Enterprise Notification Foundation

**Status:** Accepted  
**Date:** 2026-07-13  
**Phase:** PHASE_11A

## Context

PHASE_10D completed authentication certification. Multiple subsystems (user activation, password reset, integrity alerts, due reminders, scheduled reports) require a provider-agnostic notification infrastructure. Real email/SMS delivery is explicitly deferred to PHASE_11B/11C.

## Decision

### Schema (additive)

| Model / Enum | Purpose |
|--------------|---------|
| `NotificationChannel` | `EMAIL`, `SMS`, `IN_APP` |
| `NotificationStatus` | `PENDING`, `PROCESSING`, `SENT`, `FAILED`, `CANCELLED` |
| `NotificationType` | `USER_ACTIVATION`, `PASSWORD_RESET`, `FINANCIAL_ALERT`, `INTEGRITY_ALERT`, `DUE_REMINDER`, `SYSTEM` |
| `Notification` | Queued notification record with retry metadata |
| `NotificationTemplate` | Bilingual templates keyed by `key + locale + channel` |
| `NotificationDeliveryAttempt` | Immutable provider delivery log |

### Service module: `src/lib/notifications/`

| File | Purpose |
|------|---------|
| `notification-service.ts` | create, queue, send, retry, cancel, get, search |
| `notification-provider.ts` | `NotificationProvider` interface + `ConsoleEmailProvider` |
| `notification-template-service.ts` | `renderNotificationTemplate`, `getTemplate`, `searchTemplates` |
| `notification-audit.ts` | Audit writers inside transactions |
| `notification-queue.ts` | Queue eligibility (worker-ready placeholder) |
| `notification-query.ts` | Paginated Prisma queries |

### Lifecycle

```
PENDING → PROCESSING → SENT
PENDING → CANCELLED
PROCESSING → FAILED → (retry) → PROCESSING
```

Illegal transitions throw `NotificationLifecycleError`.

### Provider abstraction

```typescript
interface NotificationProvider {
  send(payload: NotificationPayload): Promise<NotificationDeliveryResult>;
}
```

PHASE_11A ships `ConsoleEmailProvider` only — logs to stdout, stores delivery attempts. No SMTP, SendGrid, Resend, or Twilio.

### Permissions

| Permission | Super_Admin | Accounts |
|------------|-------------|----------|
| `notifications:view` | ✓ | ✓ |
| `notifications:create` | ✓ | ✓ |
| `notifications:retry` | ✓ | ✓ |

### Routes

- `/settings/notifications` — read-only notifications + templates console

### Template seeds

Bilingual (`en`, `bn`) templates:

- `USER_ACTIVATION_EMAIL`
- `PASSWORD_RESET_EMAIL`
- `DUE_REMINDER_EMAIL`
- `INTEGRITY_ALERT_EMAIL`

Placeholders: `{{name}}`, `{{link}}`, `{{company}}`, `{{date}}`

### Audit integration

Reuses existing `AuditLog` model. Actions registered in `OPERATIONAL_AUDIT_ACTIONS`:

- `NOTIFICATION_CREATED`
- `NOTIFICATION_SENT`
- `NOTIFICATION_FAILED`
- `NOTIFICATION_RETRIED`
- `NOTIFICATION_CANCELLED`

## Non-goals (PHASE_11A)

- SMTP / SendGrid / Resend / Twilio delivery
- Background workers / cron jobs
- Authentication flow integration
- Template editor UI
- SMS delivery

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| LedgerEntry / Dealer.currentBalance | No |
| Due / statement / reconciliation | No |
| Territory RBAC engine | No |
| Dashboard engines | No |
| Authentication flows | No |
| Certification modules | No |

## Consequences

- Future phases (11B activation emails, 11C SMS) consume this service layer only
- All notification writes flow through `notification-service.ts`
- Delivery attempts are append-only
- Indexed search supports operations console at scale
- Certified read-only in PHASE_11D (`runNotificationCertification()`); ADR-056
