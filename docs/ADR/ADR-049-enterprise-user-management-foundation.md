# ADR-049: Enterprise User Management Foundation

**Status:** Accepted  
**Date:** 2026-07-13  
**Phase:** PHASE_10A

## Context

PHASE_09E completed audit export. ADR-047 documented missing audit writers for user lifecycle events. Operations require enterprise user provisioning with role-aware visibility, territory-scoped manager access, and immutable audit trails — without email/OTP/password-reset flows in this phase.

## Decision

### Schema (additive)

| Model / Field | Purpose |
|---------------|---------|
| `UserLifecycleStatus` enum | `INVITED → PENDING_ACTIVATION → ACTIVE → DISABLED → ARCHIVED` |
| `User.lifecycleStatus` | Authoritative lifecycle state |
| `User.mustChangePassword` | Temporary password flag (login flow unchanged in 10A) |
| `User.managerId` | SR → Manager hierarchy |
| `User.provisionedById` | Audit trail for who created the account |
| `UserProfile` | Phone, employee code, notes |
| `UserInvitation` | Invitation metadata (no email dispatch) |
| `UserActivationToken` | Hashed token storage reserved for PHASE_10B+ |

`User.isActive` retained for Auth.js backward compatibility — synced from lifecycle (`ACTIVE` only).

### Service module: `src/lib/users/`

| File | Purpose |
|------|---------|
| `user-service.ts` | Create, update, activate, disable, list, get, search |
| `user-lifecycle.ts` | Transition guards |
| `user-validation.ts` | RBAC + territory scope |
| `user-audit.ts` | `USER_CREATED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `USER_ROLE_CHANGED` writers |
| `user-password.ts` | Temporary password generation + bcrypt hashing |

### Permissions

| Permission | Super_Admin | Manager | Accounts | SR |
|------------|-------------|---------|----------|-----|
| `users:view` | ✓ | ✓ (SR in territories) | ✓ (read-only) | own profile via `getUser` |
| `users:create` | ✓ | ✓ (SR draft only) | — | — |
| `users:update` | ✓ | ✓ (SR in territories) | — | — |
| `users:activate` | ✓ | — | — | — |
| `users:disable` | ✓ | — | — | — |

Replaces monolithic `users:manage`.

### Routes

- `/settings/users` — enterprise user console (pagination, search, role/status/territory filters)

### Audit integration

Writers reuse existing `AuditLog` model inside provisioning transactions. New actions registered in `SECURITY_AUDIT_ACTIONS` for console visibility.

### Territory integration

Reuses `UserTerritoryAssignment` and `buildTerritoryScope()` — no parallel assignment system.

## Non-goals (PHASE_10A)

- Email sending / OTP / password reset UI
- Login redesign
- `runUserCertification()` (reserved PHASE_10B)
- Auth.js `mustChangePassword` enforcement at login

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| LedgerEntry / Dealer.currentBalance | No |
| Due / statement / reconciliation | No |
| Territory RBAC engine | No (consumed only) |
| Audit export engine | No |

## Consequences

- Super Admin can provision and lifecycle-manage all users with audit trail
- Managers can create SR drafts limited to assigned territories
- Accounts gains read-only user visibility
- ADR-047 user-creation audit gap closed
- PHASE_10B certification can verify privilege escalation and territory isolation
