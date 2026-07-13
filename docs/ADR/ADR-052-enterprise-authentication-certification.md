# ADR-052: Enterprise Authentication Certification

**Status:** Accepted  
**Date:** 2026-07-13  
**Phase:** PHASE_10D

## Context

PHASE_10C delivered authentication and activation expansion (login enforcement, token security, password reset foundation, audit writers). Before production hardening and email integration, the authentication layer must be certified read-only for password security, token replay protection, session enforcement, audit completeness, financial boundaries, architecture, and performance.

## Decision

### Certification module: `src/lib/certification/auth/`

| File | Purpose |
|------|---------|
| `authentication-certification-service.ts` | `runAuthenticationCertification()`, `runAuthenticationCertificationWithReport()` |
| `authentication-certification-validation.ts` | Rules 1–12 + repository scans |
| `authentication-certification-types.ts` | Result contract, `AuthenticationAuditCoverageReport` |
| `authentication-certification-report.ts` | Executive summary formatting |
| `authentication-certification.test.ts` | Certification tests |

### Rules certified

| Rule | Scope |
|------|-------|
| 1 | Password security — bcrypt, no plaintext persist, reset overwrites hash |
| 2 | Token security — SHA-256 hash, expiry, one-time use, replay blocked |
| 3 | mustChangePassword — middleware blocks dashboard/settings/reports |
| 4 | Activation flow — lifecycle transition, duplicate prevention, audit |
| 5 | Password reset — request/validate/complete with expiry and audit |
| 6 | Role login matrix — redirect behaviour per role |
| 7 | Privilege escalation — bypass attempts blocked |
| 8 | Audit completeness — `AuthenticationAuditCoverageReport` |
| 9 | Financial boundary — no posting-service / ledger imports |
| 10 | Architecture — imports limited to approved dependencies |
| 11 | Performance — structural + optional live DB under 1000ms |
| 12 | Session security — lifecycle, mustChangePassword, disabled users |

### Coverage report

`AuthenticationAuditCoverageReport` measures five authentication audit actions:

- `USER_ACTIVATION_STARTED`, `USER_ACTIVATION_COMPLETED`
- `USER_PASSWORD_CHANGED`, `USER_PASSWORD_RESET_REQUESTED`, `USER_PASSWORD_RESET_COMPLETED`

### Approval gate

`phase10dApproved: true` when:

- Zero critical failures
- Overall score ≥ 9.0
- Password, token, session, financial boundary, and architecture subsystems pass

## Non-goals

- Email/SMS delivery
- MFA / OTP
- Auth feature changes
- Modifying certified financial, due, dashboard, or user management engines

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| User service (PHASE_10A) | No |
| Auth service (PHASE_10C) | No |
| Audit export engine | No |

## Consequences

- `runAuthenticationCertification()` is the pre-production auth gate
- Email integration may proceed when `phase10dApproved: true`
- PHASE_10B user certification remains valid independently
