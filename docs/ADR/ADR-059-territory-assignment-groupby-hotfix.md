# ADR-059: Territory Assignment groupBy Hotfix

**Status:** Accepted  
**Date:** 2026-07-18  
**Phase:** PHASE_11E.2

## Context

Territory-related surfaces failed at runtime with PostgreSQL error `42702: column reference "id" is ambiguous`.

Generated SQL from Prisma:

```sql
SELECT COUNT("id") AS "_count$id",
       "public"."UserTerritoryAssignment"."territoryId"
FROM "public"."UserTerritoryAssignment"
LEFT JOIN "public"."User" AS "j0" ON ("j0"."id") = ("public"."UserTerritoryAssignment"."userId")
WHERE ...
GROUP BY "public"."UserTerritoryAssignment"."territoryId"
```

The failing query was `batchSrCounts()` in the territory map service — not the territory assignment settings CRUD actions (those already use `findMany`).

## Root Cause

`src/lib/dashboard/maps/map-service.ts` used:

```typescript
client.userTerritoryAssignment.groupBy({
  by: ["territoryId"],
  where: {
    isActive: true,
    territoryId: { in: territoryIds },
    user: { role: "SR", isActive: true },
  },
  _count: { id: true },
});
```

The `user: { role, isActive }` relation filter forces Prisma to JOIN `User`. Both tables expose an `id` column. Prisma emitted unqualified `COUNT("id")`, which PostgreSQL rejects as ambiguous.

This likely surfaced after PHASE_10 user-management schema matured and SR-count map metrics exercised the join path at scale (many territories in scope).

## Decision

Replace `groupBy` + `_count.id` with `findMany` + in-memory reduction:

```typescript
const rows = await client.userTerritoryAssignment.findMany({
  where: {
    isActive: true,
    territoryId: { in: territoryIds },
    user: { role: "SR", isActive: true },
  },
  select: { territoryId: true },
});

// reduce to Map<territoryId, count>
```

### Preserved

- Territory RBAC scope via `buildTerritoryScope` (unchanged)
- SR role + active user filters (unchanged)
- Active assignment filter (unchanged)
- Batched map metrics architecture (unchanged)
- Dealer `groupBy` (no relation join — still safe)

### Non-goals

- No raw SQL
- No suppression of errors
- No RBAC filter removal
- No territory assignment UI redesign

## Consequences

- Territory map SR counts load without PostgreSQL ambiguity errors
- Dashboard map card and analytics surfaces recover
- Territory assignment admin (`/settings/territory-assignments`) continues using existing `findMany` paths
- Slightly more rows transferred vs SQL `GROUP BY` — acceptable for map territory cardinality

## Verification

| Check | Result |
|-------|--------|
| `map.test.ts` — SR count via findMany | Pass |
| `npm run build` | Pass |
| Financial / due / audit / notification modules | Untouched |
