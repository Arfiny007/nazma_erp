# NEXT ACTION

## Current State

PHASE_10B_ENTERPRISE_USER_MANAGEMENT_CERTIFICATION is **complete** (2026-07-13):

- `src/lib/certification/users/` — Rules 1–12, repository scans, performance audit
- `runUserCertification()` / `runUserCertificationWithReport()` — `phase10cApproved: true`
- `UserAuditCoverageReport` — all 5 user audit actions covered
- ADR-050 authored; `user-certification.test.ts` — 20 tests

PHASE_10A foundation remains certified and unchanged.

---

## Next Steps

### 1. User Activation UX (PHASE_10C)

- Enforce `mustChangePassword` at login
- `UserActivationToken` issuance flow (hashed tokens)
- Email invitation dispatch (optional)
- OTP / password reset flows

### 2. Dashboard Exports (follow-on)

- PDF / Excel exports for dashboard + map data

### Explicitly Out of Scope (until respective phase)

- Audit replay / repair tooling
- Chart of Accounts / full GL
- Email/SMS document delivery

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
- `runUserCertification()` is the pre-PHASE_10C user management gate
- User lifecycle: `INVITED → PENDING_ACTIVATION → ACTIVE → DISABLED → ARCHIVED`
- `User.isActive` kept in sync with `lifecycleStatus` for Auth.js backward compatibility
- All balance mutations continue through `posting-service.ts` only
