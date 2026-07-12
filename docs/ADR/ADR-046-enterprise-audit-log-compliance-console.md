# ADR-046: Enterprise Audit Log & Operational Compliance Console

**Status:** Accepted  
**Date:** 2026-07-13  
**Phase:** PHASE_09D

## Context

PHASE_09C certified territory map visualization. Operations teams require a production-grade audit and compliance console to investigate financial events, dealer changes, security-sensitive actions, and system integrity activity without mutating certified engines.

`AuditLog` rows already exist from posting service, invoice/collection/order/challan workflows, and allocation engine. No duplicate audit generation is permitted.

## Decision

### Audit module: `src/lib/audit/`

| File | Purpose |
|------|---------|
| `audit-service.ts` | `getAuditConsoleData()` read orchestration |
| `audit-query.ts` | Scoped Prisma queries, pagination, search |
| `audit-types.ts` | `AuditRecord`, `AuditFilters`, summary contracts |
| `audit-mappers.ts` | DTO mapping, timeline grouping, metadata extraction |
| `audit-validation.ts` | Role/category guards, filter normalization |

### Contract

```ts
type AuditRecord = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  userName: string | null;
  role: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};
```

### RBAC

| Role | Visibility |
|------|------------|
| Super_Admin | All audit events |
| Accounts | Financial + integrity categories only |
| Manager | Events for entities in assigned territories via `buildTerritoryScope()` |
| SR | Events for SR-assigned dealers and related invoices/collections/orders |

Permission: `audit:view` on all four roles.

### Routes

- `/audit` — production console
- `/dashboard/audit` — alias redirect

### UI

`src/components/audit/` — summary cards, server-side filters, table, timeline, badges, empty/skeleton states.

### Data rules

- Read-only — no mutation, replay, or repair
- Consumes existing `AuditLog` rows only
- Server-side filtering and pagination
- Metadata flattened from `oldValue`/`newValue` without client aggregation
- Territory scope resolved via batched entity ID resolution (no N+1 per row)

## Non-goals

- New audit event generation in this phase
- Export / compliance archive delivery
- Login audit instrumentation (reserved action constants only)

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| Due engine | No |
| Dashboard analytics | No |
| Territory RBAC | No (consumed only) |
| Integrity monitor | No |
| Reconciliation engine | No |

## Consequences

- Investigators gain immutable operational visibility
- Accounts and managers can audit within role boundaries
- Future login / integrity scan audit writers can use reserved action constants without console redesign
