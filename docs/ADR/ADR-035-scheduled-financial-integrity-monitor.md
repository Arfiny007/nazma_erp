# ADR-035: Scheduled Financial Integrity Monitor — PHASE_07E4

Date: 2026-07-10

Status: ACCEPTED

Phase: PHASE_07E4_SCHEDULED_FINANCIAL_INTEGRITY_MONITOR

Builds on: ADR-034 (Reconciliation Engine), ADR-033, ADR-032, ADR-027

---

## Context

PHASE_07E3 shipped `reconcileDealer()` and `reconcileAllDealers()` — read-only
integrity detection for every dealer subledger. Operators could run scans
manually via `/ledger/reconciliation`, but no scan history was persisted.

Production financial operations require:

> Run reconciliation automatically and store scan summaries for audit and future
> dashboard / notification infrastructure.

**Explicitly out of scope:** dashboards, notifications, repair actions,
exports, cron configuration, Vercel jobs, background workers, balance
mutation, ledger creation, per-dealer report persistence.

---

## Executive Summary

**Verdict: SCHEDULED FINANCIAL INTEGRITY MONITOR SHIPPED (ORCHESTRATION LAYER)**

The ERP can now execute `runFinancialIntegrityScan()`, which orchestrates the
existing reconciliation engine, persists repository-wide summary counts, and
exposes scan history via server actions and a dev page at `/ledger/integrity`.

Scheduling infrastructure (cron, workers) is deferred — only the callable
entry point is shipped.

---

## 1. Architectural Boundary

```
LedgerEntry + Dealer.currentBalance
        ↓
Reconciliation Engine (PHASE_07E3) — reconcileAllDealers()
        ↓
Integrity Monitor (PHASE_07E4) — runFinancialIntegrityScan()
        ↓
FinancialIntegrityScan (persisted summary only)
        ↓
Future dashboard / notifications / cron
```

| Rule | Enforcement |
|------|-------------|
| Orchestration only | Calls `reconcileAllDealers()` — no duplicated Rules A/B/C |
| Summary persistence | `FinancialIntegrityScan` stores counts + timing only |
| No dealer detail rows | Per-dealer reports remain on-demand via reconciliation engine |
| No financial mutation | Never calls posting-service, replay, or backfill mutation |
| No scheduler | `runFinancialIntegrityScan()` exposed for future infra to invoke |

---

## 2. Schema

```prisma
enum FinancialIntegrityScanStatus {
  Completed
  Failed
}

model FinancialIntegrityScan {
  id                   String @id @default(uuid())
  startedAt            DateTime
  completedAt          DateTime?
  durationMs           Int?
  totalDealers         Int
  consistentDealers    Int
  driftedDealers       Int
  missingLedgerDealers Int
  corruptedDealers     Int
  status               FinancialIntegrityScanStatus
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

---

## 3. Module Layout

```
src/lib/ledger/monitor/
├── ledger-monitor-service.ts    — runFinancialIntegrityScan, getLatest, list
├── ledger-monitor-query.ts      — persistence queries
├── ledger-monitor-types.ts
├── ledger-monitor-validation.ts
├── ledger-monitor-errors.ts
├── ledger-monitor-report.ts
├── ledger-monitor.test.ts
└── index.ts

src/lib/actions/ledger-monitor/
├── run-financial-integrity-scan.ts
├── get-latest-integrity-scan.ts
└── list-integrity-scans.ts

src/app/(dashboard)/ledger/integrity/
├── page.tsx
└── ledger-integrity-monitor.tsx
```

Reuses `reconcileAllDealers()` from `src/lib/ledger/reconciliation/` without
modifying the reconciliation engine.

---

## 4. RBAC

Server actions and `/ledger/integrity` require `invoices:create` (financial
administration — Super_Admin and Accounts). No `permissions.ts` change.

Middleware continues to guard `/ledger/*` with `ledger:view`; the page enforces
stricter financial-admin access at the component/action layer.

---

## 5. Testing

11 unit tests cover: successful scan, empty database, drift detection,
missing ledger detection, corrupted chain detection, summary-only persistence,
multiple scans, latest scan query, reconcileAllDealers reuse, failed scan
persistence, summary parity with reconciliation engine.

---

## Decision

Accept the integrity monitor as the orchestration and persistence layer above
the reconciliation engine. Future phases may wire cron/notification/dashboard
consumers to `runFinancialIntegrityScan()` and `FinancialIntegrityScan` history
without redesign.
