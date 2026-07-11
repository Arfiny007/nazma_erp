# ADR-041: Enterprise Territory & Due Certification

**Status:** Accepted  
**Date:** 2026-07-11  
**Phase:** PHASE_08E

## Context

PHASE_08A–08D delivered geography, territory RBAC, dealer ownership history, and due reports. Before production field rollout, the organization layer and due reporting must be certified without modifying business logic.

PHASE_07F certified the financial pipeline at 9.3/10 (ADR-037). PHASE_08E certifies the territory and due layers independently.

## Decision

### Certification module: `src/lib/certification/territory/`

| Function | Purpose |
|----------|---------|
| `runTerritoryCertification()` | Executive result with subsystem scores |
| `runTerritoryCertificationWithReport()` | Full report with checks, aging reconciliations, risks |

### Eight certification rules

| Rule | Verification |
|------|--------------|
| 1 — SR isolation | List/detail/due actions use `buildTerritoryScope` / `canAccess*` |
| 2 — Manager isolation | Same TERRITORIES scope as SR |
| 3 — Super Admin global | `resolveTerritoryScopeMode` → ALL |
| 4 — Ownership transfer | `closeActiveOwnership`; invoices not rewritten |
| 5 — Due source of truth | `Dealer.currentBalance` read verbatim |
| 6 — Aging buckets | 0–30, 31–60, 61–90, 90+ classification |
| 7 — Aging vs balance | `reconcileAgingAgainstBalance()` documents delta causes |
| 8 — Repository boundary | Grep for duplicated due logic, rogue territory checks, client-side money math |

### Subsystem scores

- **Territory Security** — RBAC enforcement
- **Ownership Integrity** — transfer history, historical attribution
- **Due Accuracy** — balance source, aging, reconciliation
- **Financial Boundary** — no posting imports in due module

### Known warning

`getDealerCollectionContext` lacks territory RBAC gate — flagged as warning, not critical failure.

## Non-goals (PHASE_08E)

New features, exports, dashboards, analytics, business logic changes.

## Compliance

| Engine | Modified? |
|--------|-----------|
| Territory RBAC | No |
| Ownership service | No |
| Due report engine | No |
| Financial posting | No |

## Consequences

- Production readiness for territory/due layer is measurable and repeatable.
- Aging vs balance deltas are expected and documented — not treated as defects.
- Collection context territory gate remediated in PHASE_08E.1.
