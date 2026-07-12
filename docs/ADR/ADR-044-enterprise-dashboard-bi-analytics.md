# ADR-044: Enterprise Dashboard BI & Analytics Layer

**Status:** Accepted  
**Date:** 2026-07-11  
**Phase:** PHASE_09B

## Context

PHASE_09A delivered certified role-aware dashboards (ADR-042, ADR-043). Operations require BI visualizations — sales/collection trends, territory comparisons, SR leaderboards, integrity overview — without modifying financial engines or duplicating balance logic.

## Decision

### Analytics module: `src/lib/dashboard/analytics/`

| File | Purpose |
|------|---------|
| `analytics-service.ts` | Role-specific analytics builders |
| `analytics-query.ts` | Batched Prisma aggregates + due engine reads |
| `analytics-types.ts` | `DashboardChart` / `ChartPoint` contracts |
| `analytics-mappers.ts` | DTO mapping only |
| `analytics-validation.ts` | Scope/role guards, chart validation |

### Chart contract

```ts
type DashboardChart = {
  id: string;
  titleKey: string;
  type: "line" | "bar" | "pie" | "area";
  data: ChartPoint[];
};

type ChartPoint = { label: string; value: number };
```

### Chart UI: `src/components/dashboard/charts/`

Lightweight SVG charts — no third-party chart library. Uses enterprise blue `#1a5dad`.

### Role analytics

| Role | Charts |
|------|--------|
| SR | Monthly sales, collection, outstanding, dealer growth |
| Manager | Territory sales/collections/due, SR leaderboard (3), risk dealers, aging |
| Accounts | Receivable trend, collection efficiency, integrity overview, aging |
| Super Admin | Revenue trend, dealer/territory/user growth + `territoryHeatmap` DTO |

### Financial data sources

| Metric | Source |
|--------|--------|
| Due / aging / territory due | Due Report Engine (`getCompanyDueSummary`, dealer aggregation paths) |
| Integrity | `getLatestIntegrityScan()` |
| Sales | `Invoice.grandTotal` aggregate |
| Collections | `Collection.receivedAmount` aggregate |
| Outstanding trend | Invoice `currentDue` by issue month (not balance recomputation) |
| Collection efficiency | Collections ÷ Invoices ratio (visualization only) |

### Server actions

`getDashboardAnalytics()`, `getSrAnalytics()`, `getManagerAnalytics()`, `getAccountsAnalytics()`, `getAdminAnalytics()` — `ActionResult<T>`, `dashboard:view` permission.

Dashboard page fetches dashboard + analytics in parallel.

## Non-goals (PHASE_09B)

Territory map UI, forecasting, export, email reports, query caching layer.

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| Due report engine | No |
| Dashboard foundation (PHASE_09A) | No service changes |
| Territory RBAC | No |
| Certification modules | No |

## Consequences

- All dashboards gain BI widgets consuming certified engines.
- Chart values are pre-aggregated server-side; React renders SVG only.
- Admin `territoryHeatmap` DTO ready for PHASE_09C map UI.
