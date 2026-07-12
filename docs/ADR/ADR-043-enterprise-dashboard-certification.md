# ADR-043: Enterprise Dashboard Certification

**Status:** Accepted  
**Date:** 2026-07-11  
**Phase:** PHASE_09A.5

## Context

PHASE_09A delivered role-aware dashboards consuming Due Report, Integrity Monitor, and Reconciliation engines. Before PHASE_09B (charts/BI), the dashboard layer must be certified for:

- Territory isolation (SR/Manager)
- Global visibility (Accounts/Super Admin)
- KPI parity with certified financial engines
- Architectural boundaries (no duplicate balance logic)
- Performance acceptability on demo data

## Decision

### Certification module: `src/lib/certification/dashboard/`

| Function | Purpose |
|----------|---------|
| `runDashboardCertification()` | Full certification result |
| `runDashboardCertificationWithReport()` | Report with checks, risks, manual checklist |

### Rules 1–9

| Rule | Scope |
|------|-------|
| 1 | SR isolation — territory scope, assigned dealers, filtered activity |
| 2 | Manager isolation — supervised territories, SR leaderboard |
| 3 | Accounts global visibility — ALL scope, due/reconciliation engines |
| 4 | Super Admin unrestricted access — company aggregates |
| 5 | Financial authority — no posting-service, createLedgerEntry, balance mutation |
| 6 | KPI integrity — due KPIs match `getCompanyDueSummary()` |
| 7 | Territory leakage scan — dashboard-query findMany uses merge filters |
| 8 | Performance — role dashboards under 1000ms on demo seed (live DB) |
| 9 | Architecture — approved imports only; no client-side money math |

### Output contract

```ts
{
  overallScore, securityScore, financialScore,
  performanceScore, architectureScore,
  findings, warnings, risks,
  phase09bApproved
}
```

PHASE_09B is **blocked** until `phase09bApproved === true` (no critical failures, production threshold met, security/financial/architecture subsystems pass).

## Non-goals (PHASE_09A.5)

Dashboard optimization, chart implementation, query caching, Prisma middleware profiling.

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| Due report engine | No |
| Dashboard service | No |
| Territory RBAC | No |
| All financial engines | No |

## Consequences

- Dashboard layer certified before BI/charts phase.
- Performance warnings documented for `reconcileAllDealers()` on Accounts/Admin load.
- Live performance audit requires DATABASE_URL + demo seed users.
