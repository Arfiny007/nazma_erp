# ADR-051: Enterprise Authentication & Activation Expansion

**Status:** Accepted  
**Date:** 2026-07-13  
**Phase:** PHASE_10C

## Context

PHASE_10A provisioned users with `mustChangePassword` and reserved `UserActivationToken` storage. PHASE_10B certified user management (`phase10cApproved: true`). Operations require login enforcement, self-service activation, password change gating, and password-reset infrastructure — without email delivery or auth/RBAC redesign.

## Decision

### Login enforcement

- `mustChangePassword` propagated through Auth.js JWT/session
- Post-login redirect to `/auth/change-password` when flag is true
- Middleware blocks dashboard, settings, reports, and all protected routes except `/auth/change-password` and `/api/auth/signout`

### Activation workflow

| Step | Behaviour |
|------|-----------|
| User created (`PENDING_ACTIVATION`) | Temporary password + hashed activation token issued |
| User opens `/auth/activate?token=…` | Validates token, sets permanent password |
| Completion | `ACTIVE`, `mustChangePassword: false`, token consumed |

Token rules: SHA-256 hashed storage, 7-day expiry, one-time use, replay blocked via conditional `updateMany`.

### Password reset foundation (no email)

| Function | Purpose |
|----------|---------|
| `requestPasswordReset()` | Issues hashed `UserPasswordResetToken` (1-hour TTL) |
| `validateResetToken()` | Pre-submit token validation |
| `completePasswordReset()` | Consumes token, updates password |

Additive schema: `UserPasswordResetToken` model.

### Routes

- `/auth/activate` — public, bilingual
- `/auth/change-password` — authenticated, mandatory when flagged
- `/auth/forgot-password` — public request form
- `/auth/reset-password` — public token consumption

### Server actions

`activate-user-account.ts`, `change-password.ts`, `request-password-reset.ts`, `reset-password.ts` — all `AuthActionResult<T>`, Zod-validated, audited.

### Audit writers (extended)

- `USER_PASSWORD_CHANGED`
- `USER_PASSWORD_RESET_REQUESTED`
- `USER_PASSWORD_RESET_COMPLETED`
- `USER_ACTIVATION_STARTED`
- `USER_ACTIVATION_COMPLETED`

Registered in `SECURITY_AUDIT_ACTIONS` for audit console visibility.

### PHASE_10D preparation

Future `runAuthenticationCertification()` will verify:

- Token hashing and expiry
- Replay protection
- Password bcrypt enforcement
- Audit completeness for five new actions
- `mustChangePassword` middleware bypass resistance
- Login redirect correctness per role

## Non-goals

- Email/SMS delivery
- OTP flows
- Auth.js provider redesign
- RBAC / permission changes
- `runAuthenticationCertification()` implementation (PHASE_10D)

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| Due / statement / reconciliation | No |
| Territory RBAC engine | No |
| Dashboard engine | No |
| Audit export engine | No (writers extended only) |
| User certification (10B) | Unchanged |

## Consequences

- Provisioned users receive activation links alongside temporary passwords
- Active users with temporary passwords cannot bypass password change
- Password reset infrastructure ready for email integration in a future phase
- PHASE_10D certification can gate production auth hardening
