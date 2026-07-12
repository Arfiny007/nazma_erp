# ADR-050: Enterprise User Management Certification

**Status:** Accepted  
**Date:** 2026-07-13  
**Phase:** PHASE_10B

## Context

PHASE_10A shipped the enterprise user management foundation (`src/lib/users/`, `/settings/users`, granular RBAC, lifecycle state machine, audit writers). Before PHASE_10C (login enforcement, optional email/OTP), the user layer must be certified for privilege escalation protection, territory isolation, lifecycle safety, audit coverage, financial boundary integrity, architecture, performance, and credential storage.

## Decision

### Certification module: `src/lib/certification/users/`

| File | Purpose |
|------|---------|
| `user-certification-service.ts` | `runUserCertification()`, `runUserCertificationWithReport()` |
| `user-certification-validation.ts` | Rules 1–12 + repository scans |
| `user-certification-types.ts` | Result contract, `UserAuditCoverageReport` |
| `user-certification-report.ts` | Executive summary formatting |
| `user-certification.test.ts` | 20 certification tests |

### Rules certified

| Rule | Scope |
|------|-------|
| 1 | Super Admin full user lifecycle authority |
| 2 | Manager isolation — SR-only create/update; no activate/disable; territory-bound |
| 3 | SR isolation — no user console; self profile only |
| 4 | Accounts read-only — `users:view` without mutation |
| 5 | Territory security — `buildUserVisibilityWhere` + leakage scan |
| 6 | Privilege escalation blocked — `assertAssignableRole` matrix |
| 7 | Lifecycle correctness — illegal transitions rejected; ARCHIVED terminal |
| 8 | Audit completeness — `UserAuditCoverageReport` (covered / partial / missing) |
| 9 | Financial boundary — no posting-service / ledger / due imports |
| 10 | Architecture — imports limited to RBAC, audit, prisma, permissions, validators |
| 11 | Performance — list/search/get under 1000ms with demo seed |
| 12 | Security — bcrypt hashing; no plaintext password persist; `tokenHash` schema |

### Coverage report

`UserAuditCoverageReport` measures five user audit actions:

- `USER_CREATED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `USER_ROLE_CHANGED`, `USER_UPDATED`

All five have writers in `user-service.ts`. Territory-only metadata changes share `USER_UPDATED` (documented as partial metadata, not a missing writer).

### Approval gate

`phase10cApproved: true` when:

- Zero critical failures
- Overall score ≥ 9.0
- Security, territory isolation, lifecycle, financial boundary, and architecture subsystems pass

### Known warnings (non-blocking)

- `mustChangePassword` not enforced at login — deferred to PHASE_10C per ADR-049
- `UserActivationToken` writer not implemented — reserved for PHASE_10C

## Non-goals

- Email invitation dispatch
- OTP / password reset flows
- Login flow changes
- Modifying certified financial, due, dashboard, or audit export engines

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| Due engine | No |
| Territory RBAC engine | No |
| User service (`src/lib/users/`) | No |
| Audit export engine | No |

## Consequences

- `runUserCertification()` is the pre-PHASE_10C gate
- PHASE_10C may proceed when `phase10cApproved: true`
