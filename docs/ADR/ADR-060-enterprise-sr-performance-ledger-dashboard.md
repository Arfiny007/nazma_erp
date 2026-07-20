# ADR-060 — Enterprise SR Performance & Ledger Dashboard

**Status:** Accepted (Stabilization Revision — PHASE_12A.1 FULLY CERTIFIED)  
**Date:** 2026-07-20  
**Phase:** PHASE_12A — Printable SR Performance & Ledger Dashboard  
**Revision:** PHASE_12A.1 — Filter Stabilization, Split Print, ESLint Closure, and Deployment-Parity

## Context

Nazma ERP needs a printable, territory-scoped Sales Representative performance
and ledger dashboard with:

1. Individual SR Statement (dealer-level)
2. Global SR Overview (SR-level)

The module must remain strictly read-only and must not redesign certified
financial, territory, dashboard, or document engines.

PHASE_12A.1 suspends the prior CERTIFIED verdict until filters, split print,
attribution diagnostics, the full Vitest gate, and repository-wide ESLint
(`npx eslint .` exit 0) are corrected.

## Decision

### Read-only reporting boundary

`src/lib/reports/sr-performance/` and its actions/UI/print composers perform
only reads. Forbidden:

- LedgerEntry / Dealer balance / Invoice / Collection mutations
- posting-service calls
- AuditLog / Notification creation
- `$executeRaw` / `$queryRawUnsafe`

Parameterized `$queryRaw` is allowed for bounded read aggregation.

### Canonical filter contract (PHASE_12A.1)

URL search parameters are the single canonical report state:

`from`, `to`, `territoryId`, `srId`, `srSearch`, `partySearch`, `page`, `pageSize`

Screen actions and print actions share `parseSrPerformanceFilters(searchParams)`.
Date-only values are parsed as local calendar dates (`parseLocalDateOnly`) —
never via timezone-shifting `new Date("YYYY-MM-DD")`.

Date semantics:

- `transactionDate >= startOfDay(from)`
- `transactionDate < startOfDay(to + 1 day)`

Filter → query matrix:

| Filter | Overview | Individual | Individual Print | Overview Print |
|--------|----------|------------|------------------|----------------|
| from/to | Required | Required | Required | Required |
| territoryId | Required | Required | Required | Required |
| srId | Highlight only | Required | Required | Not used |
| srSearch | Required | Not required | Not required | Required |
| partySearch | Not required | Required | Required | Not used |

Invalid `srId` after territory change is cleared deterministically (soft resolve).

### Financial source of truth

`LedgerEntry` is authoritative.

- Previous Due = balance of the latest ledger row with
  `transactionDate < fromInclusive`, ordered by certified statement DESC order:
  `transactionDate`, `postingDate`, `id`
- Sales = `SUM(debit)` where `postingType = Issue`
- Collection = `SUM(credit)` for `Collection` minus `SUM(debit)` for
  `Reversal` + `referenceType = Collection`
- Balance Due / Net Balance = Previous Due + Sales − Collection (Decimal only)
- Reconciliation delta = `(Previous Due + SUM(debit − credit)) − Balance Due`

`Dealer.currentBalance` is never used as the historical source.

### Territory attribution semantics

- Scope via `buildTerritoryScope()`
- Active SRs via `UserTerritoryAssignment` (`isActive`)
- Dealer → SR attribution via active `DealerOwnershipHistory.assignedSrId`
- Territory filter intersects authenticated scope

**PHASE_12A.1:** Multiple SRs assigned to one territory are **not** a
user-facing financial warning. Warnings are raised only for dealer
ownership attribution integrity problems:

- duplicate active `assignedSrId` values for one dealer
- multiple active ownership rows (ambiguous)
- missing active ownership when attribution is required

`overlappingTerritoryIds` may remain as developer metadata only.

### Split print modes (PHASE_12A.1)

One print route with explicit mode:

- `/reports/sr-performance/print?mode=individual&...` — dealer table only; requires authorized `srId`
- `/reports/sr-performance/print?mode=overview&...` — SR overview only; ignores `partySearch`

Preview dialogs, dedicated print route, and Save-as-PDF share the same DTO and
printable component. Document Platform is reused additively.

### Anti-N+1 query design

Fixed query blocks:

1. Scope + active SRs / assignments
2. Scoped dealers
3. Opening balances (`DISTINCT ON` raw SQL)
4. Period movements (scalar `GROUP BY dealerCode`)

No Prisma calls inside SR/dealer loops. Relation-filtered `groupBy` +
`_count.id` is forbidden (ADR-059).

### Decimal precision

All money uses `Prisma.Decimal` / Decimal(18,2) strings at DTO boundary.
No native `number` arithmetic for money.

### Unsupported posting behavior

Posting types outside Issue / Collection / Collection-Reversal do not enter
Sales or Collection columns. They contribute to ledger movement and produce
reconciliation diagnostics / warnings.

### Authorization

Permission: `reports:sr-performance:view` — Super_Admin + Manager only.
Enforced in middleware (`/reports/sr-performance`), page, actions, and nav.

### Non-goals

- No mutation of financial engines
- No redesign of Territory RBAC / Due Report / Dashboard / Document Platform
- No Excel export in this phase
- No charts / KPI widgets
- No Accounts or SR access

## Consequences

- Route: `/reports/sr-performance` (+ `/print?mode=individual|overview`)
- Certification: `runSrPerformanceCertification()` RULE_SR_REPORT_01–15
- Approval flags: **`phase12a1Approved`** / **`approved`** (legacy `phase12aApproved` alias retained)
- RULE_SR_REPORT_15: repository-wide ESLint gate evidence (`npx eslint .` exit 0)
- Soft-resolve: out-of-scope `srId` cleared/replaced and URL canonicalized
- Frozen engines remain untouched
- Full Vitest suite must pass in a valid PostgreSQL environment before CERTIFIED
- Browser smoke (Super_Admin + Manager) required for PHASE_12A.1 evidence closure
- ESLint closure (2026-07-20): four baseline `react-hooks/set-state-in-effect` defects corrected via derived state / `useSyncExternalStore`; TECH_DEBT SR4 closed
- Deployment-parity (2026-07-20): app container recreated on certified image with `RUNNING_IMAGE_MATCH=true`; LanguageProvider / geography / assignments / SR+warning smokes re-verified on that runtime
