# ADR-038: Enterprise Territory RBAC Engine

**Status:** Accepted  
**Date:** 2026-07-11  
**Phase:** PHASE_08B

## Context

PHASE_08A introduced the Bangladesh geography hierarchy (Division → District → Territory) and optional `Dealer.territoryId` FK. The ERP previously relied on flat role-based permissions (`permissions.ts`) without territory isolation.

Enterprise field operations require territory-scoped visibility for SR and Manager roles without changing financial engines.

## Decision

### UserTerritoryAssignment

Maps User (SR / Manager) to Territory with `isPrimary`, `isActive`, `revokedAt`. Unique on `(userId, territoryId)`.

### Centralized module: `src/lib/rbac/territory/`

- `buildTerritoryScope(userId)` — ALL / TERRITORIES / NONE
- `canAccessDealer`, `canAccessOrder`, `canAccessCollection`, `canAccessStatement`
- `mergeDealerTerritoryScope`, `mergeOrderTerritoryScope`, `mergeCollectionTerritoryScope`

### Role rules

| Role | Scope |
|------|-------|
| Super_Admin | ALL |
| Accounts | ALL |
| Manager | Assigned territories |
| SR | Assigned territories |

### Integration

Server-side scope injection on list actions; `canAccess*` on detail/statement actions. Assignment admin at `/settings/territory-assignments`.

## Non-goals (PHASE_08B)

Dealer ownership history, transfer workflow, analytics, due reports.

## Compliance

Financial engines (posting, ledger, statement calculations, reconciliation, certification) — NOT modified.
