# NEXT ACTION

## Current State

PHASE_10C_ENTERPRISE_AUTHENTICATION_ACTIVATION_EXPANSION is **complete** (2026-07-13):

- `mustChangePassword` enforced at login + middleware
- `UserActivationToken` issuance on provisioning (SHA-256 hashed, 7-day TTL, one-time use)
- `UserPasswordResetToken` model + reset foundation (no email delivery)
- Auth routes: `/auth/activate`, `/auth/change-password`, `/auth/forgot-password`, `/auth/reset-password`
- Server actions: `activateUserAccount`, `changePassword`, `requestPasswordReset`, `resetPassword`
- Five new audit writers registered in `SECURITY_AUDIT_ACTIONS`
- `authentication-expansion.test.ts`
- ADR-051 authored

PHASE_10B certification remains valid and unchanged.

---

## Next Steps

### 1. Enterprise Authentication Certification (PHASE_10D)

- `src/lib/certification/auth/` — token security, password security, audit completeness
- `runAuthenticationCertification()` / `runAuthenticationCertificationWithReport()`
- Verify login enforcement, replay protection, middleware bypass resistance
- ADR-052 (planned)

### 2. Email Integration (follow-on)

- Wire activation + password reset tokens to email dispatch

### 3. Dashboard Exports (follow-on)

- PDF / Excel exports for dashboard + map data

### Explicitly Out of Scope (until respective phase)

- Audit replay / repair tooling
- Chart of Accounts / full GL
- Email/SMS document delivery (infrastructure ready, dispatch not wired)

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |
| Manager | manager1@nazma.test | (seed) |
| SR | sr1@nazma.test | (seed) |
| Accounts | accounts1@nazma.test | (seed) |

---

## Notes

- `runFinancialCertification()` is the pre-release financial gate — run with live PostgreSQL for full score
- `runAuditCertification()` is the pre-export audit gate
- `runUserCertification()` is the pre-PHASE_10C user management gate (still valid)
- `runAuthenticationCertification()` — PHASE_10D (not yet implemented)
- User lifecycle: `INVITED → PENDING_ACTIVATION → ACTIVE → DISABLED → ARCHIVED`
- `User.isActive` kept in sync with `lifecycleStatus` for Auth.js backward compatibility
- All balance mutations continue through `posting-service.ts` only
