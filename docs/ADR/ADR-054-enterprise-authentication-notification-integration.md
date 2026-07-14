# ADR-054: Enterprise Authentication Notification Integration

**Status:** Accepted  
**Date:** 2026-07-13  
**Phase:** PHASE_11B

## Context

PHASE_11A delivered provider-agnostic notification infrastructure (`ConsoleEmailProvider`, templates, lifecycle, audit). PHASE_10D certified authentication flows (activation tokens, password reset tokens) without email delivery. Operations require wiring auth events into the notification engine without redesigning either subsystem.

## Decision

### Auth notification module

| File | Purpose |
|------|---------|
| `auth-notifications.ts` | `dispatchActivationNotification`, `dispatchPasswordResetNotification`, resend helpers |
| `auth-template-mappers.ts` | Map auth payloads → template variables (`{{name}}`, `{{link}}`, `{{company}}`, `{{date}}`) |
| `auth-notification-errors.ts` | Typed eligibility / permission errors |

### Integration points

| Flow | Trigger | Template |
|------|---------|----------|
| User provisioning | `createUserRecord` when `PENDING_ACTIVATION` | `USER_ACTIVATION_EMAIL` |
| Password reset request | `requestPasswordReset` after token issuance | `PASSWORD_RESET_EMAIL` |
| Admin resend activation | `/settings/users` — Super_Admin only | `USER_ACTIVATION_EMAIL` |
| Admin resend reset | `/settings/users` — Super_Admin only | `PASSWORD_RESET_EMAIL` |

All delivery flows through:

```
createNotification() → queueNotification() → sendNotification() → ConsoleEmailProvider
```

Failed deliveries may be retried via `retryNotification()` (admin resend checks for retriable FAILED notification first).

### Audit sequence

**Activation provisioning:**

```
USER_CREATED → USER_ACTIVATION_STARTED → NOTIFICATION_CREATED → NOTIFICATION_SENT
```

**Activation completion (unchanged endpoint):**

```
USER_ACTIVATION_COMPLETED
```

**Password reset:**

```
USER_PASSWORD_RESET_REQUESTED → NOTIFICATION_CREATED → NOTIFICATION_SENT → USER_PASSWORD_RESET_COMPLETED
```

`USER_ACTIVATION_STARTED` moved from completion transaction to notification dispatch (PHASE_11B).

### Admin resend rules

- Super_Admin only
- Activation: `INVITED` or `PENDING_ACTIVATION` only
- Password reset: `ACTIVE` only
- `DISABLED` and `ARCHIVED` users rejected

### Dev-only reset link

`requestPasswordResetAction` returns reset URL only when `NODE_ENV === "development"`.

## Non-goals (PHASE_11B)

- SMTP / SendGrid / Resend / Twilio
- Background workers / cron
- SMS delivery
- Notification certification module
- Template editor

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| LedgerEntry / Dealer.currentBalance | No |
| Due / dashboard / territory RBAC | No |
| notification-service.ts lifecycle | No (consumed only) |
| Authentication token security | No (reused) |
| Certification modules | No |

## Consequences

- Activation and reset emails are logged via `ConsoleEmailProvider` until PHASE_11C SMTP
- Future SMTP provider swap requires only `notification-provider.ts` change
- Admin can resend from user console without bespoke delivery code
- Certified read-only in PHASE_11D (`runNotificationCertification()`); ADR-056
