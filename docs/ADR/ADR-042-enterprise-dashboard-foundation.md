# ADR-042: Enterprise Dashboard Foundation

**Status:** Accepted  
**Date:** 2026-07-11  
**Phase:** PHASE_09A

## Context

PHASE_08 certified territory RBAC, dealer ownership, due reports, and financial boundaries. The homepage at `/` was a static placeholder with hardcoded `"—"` values and no role awareness.

Operations require role-specific landing dashboards that consume existing certified engines without duplicating financial logic.

## Decision

### Dashboard module: `src/lib/dashboard/`

| File | Purpose |
|------|---------|
| `dashboard-service.ts` | Role-specific dashboard builders |
| `dashboard-query.ts` | Operational aggregates (sales, collections, counts) |
| `dashboard-types.ts` | `DashboardPayload` contract |
| `dashboard-mappers.ts` | Presentation formatting only |
| `dashboard-validation.ts` | Role/scope guards |

### `DashboardPayload` contract

```ts
type DashboardPayload = {
  summary: DashboardSummary;
  widgets: DashboardWidgets;
  generatedAt: string;
};
```

### Role routing

Single route `/dashboard` with server-side role resolution via `resolveDashboardForRole()`:

| Role | Scope | Widgets |
|------|-------|---------|
| SR | Assigned territories | My dealers, sales, due, collections, pending invoices, recent activity |
| Manager | Assigned territories | Territory sales/collections, SR leaderboard, risk dealers, territory comparison |
| Accounts | ALL | Receivables, collections, due, pending allocations, financial health, reconciliation |
| Super Admin | ALL | Company revenue/collections/due, dealer growth, system health, integrity |

Homepage `/` redirects to `/dashboard`.

### Financial data sources (mandatory)

| Metric | Source |
|--------|--------|
| Due / receivables | `getCompanyDueSummary()` — Due Report Engine |
| SR / territory due tables | `getDueReport()`, `getSrDueReport()`, `getTerritoryDueReport()` |
| Integrity / reconciliation | `getLatestIntegrityScan()`, `reconcileAllDealers()` |
| Invoice sales totals | Prisma aggregate on `Invoice.grandTotal` (operational, not balance) |
| Collection totals | Prisma aggregate on `Collection.receivedAmount` (operational) |

**Never recompute:** `Dealer.currentBalance`, statement totals, ledger balances.

### Server actions

`src/lib/actions/dashboard/` — `getDashboard()`, `getSrDashboard()`, `getManagerDashboard()`, `getAccountsDashboard()`, `getAdminDashboard()` with `ActionResult<T>` and `dashboard:view` permission.

### UI

`src/components/dashboard/` — cards and tables only. No charts, exports, or analytics.

## Non-goals (PHASE_09A)

BI analytics, charts, export, notifications, targets, forecasting, email reports.

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| Due report engine | No |
| Statement engine | No |
| Reconciliation engine | No |
| Integrity monitor | No |
| Territory RBAC engine | No |
| Financial certification | No |

## Consequences

- Every role lands on a scoped dashboard consuming certified engines.
- Operational invoice/collection aggregates are clearly separated from balance/due authority.
- PHASE_09B can add charts/exports without redesigning the dashboard contract.
