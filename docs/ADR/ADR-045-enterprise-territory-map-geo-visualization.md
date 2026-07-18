# ADR-045: Enterprise Territory Map & Geo Visualization

**Status:** Accepted  
**Date:** 2026-07-13  
**Phase:** PHASE_09C

## Context

PHASE_09B delivered BI analytics including a `territoryHeatmap` DTO for Super Admin. Operations require an interactive territory visualization layer on `/dashboard` — division → district → territory grid — without modifying financial engines, territory RBAC, or due calculations.

## Decision

### Map module: `src/lib/dashboard/maps/`

| File | Purpose |
|------|---------|
| `map-service.ts` | Role-specific map builders with batched Prisma queries |
| `map-types.ts` | `TerritoryMapNode`, `TerritoryMapFilters` contracts |
| `map-mappers.ts` | DTO mapping + risk classification |
| `map-validation.ts` | Scope/role guards, filter parsing, period resolution |
| `map-errors.ts` | Map-specific errors |

### Map UI: `src/components/dashboard/maps/`

Grid-based territory visualization grouped by division/district. No GIS polygons in this phase — future GIS integration must remain possible via `TerritoryMapNode` contract.

### Role views

| Role | Visibility | Capabilities |
|------|------------|--------------|
| Super Admin | All territories | Division/district filters, risk highlight, all metrics |
| Manager | Assigned territories | Division/district filters, risk highlight, ranking |
| Accounts | All territories | Financial exposure (due/collections), no operational controls |
| SR | Own territories | Simplified map, own dealers/due |

### Financial data sources

| Metric | Source |
|--------|--------|
| Sales | `Invoice.grandTotal` batched by dealer territory |
| Collections | `Collection.receivedAmount` batched by dealer territory |
| Due | `aggregateTerritoryDue()` from analytics layer (dealer `currentBalance`) |
| Dealer count | `dealer.groupBy` by territoryId |
| SR count | `userTerritoryAssignment.findMany` + reduce by territoryId (ADR-059; was `groupBy` + `_count.id`) |

### Risk classification (visualization only)

- **HIGH:** due > collections
- **MEDIUM:** due > sales
- **LOW:** everything else

Not persisted. Not used in financial logic.

### Server actions

`getTerritoryMap()`, `getManagerTerritoryMap()`, `getAccountsTerritoryMap()`, `getAdminTerritoryMap()` — `ActionResult<T>`, `dashboard:view` permission.

Dashboard page fetches dashboard + analytics + map in parallel.

## Non-goals (PHASE_09C)

GIS polygon integration, map-driven business logic, financial recalculation, forecasting.

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| Due report engine | No |
| Dashboard analytics (PHASE_09B) | No service changes |
| Territory RBAC | No |
| Certification modules | No |

## Consequences

- Territory visualization is presentation-only; all metrics flow from certified read paths.
- Batched queries avoid N+1 per territory; target < 500ms with demo seed.
- PHASE_09D+ may add GIS polygons, exports, or drill-down without changing map contracts.
