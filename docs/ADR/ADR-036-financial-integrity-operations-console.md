# ADR-036: Financial Integrity Operations Console — PHASE_07E5

Date: 2026-07-10

Status: ACCEPTED

Phase: PHASE_07E5_FINANCIAL_INTEGRITY_OPERATIONS_CONSOLE

Builds on: ADR-034, ADR-035

---

## Context

PHASE_07E3 shipped read-only reconciliation. PHASE_07E4 shipped automated
scan orchestration with persisted `FinancialIntegrityScan` summaries. Operators
still lacked a production screen to answer:

> Is the accounting system healthy?

The dev tooling page at `/ledger/integrity` was insufficient for daily
financial administration.

**Explicitly out of scope:** cron, notifications, repair tools, exports,
schema changes, accounting logic duplication.

---

## Executive Summary

**Verdict: FINANCIAL INTEGRITY OPERATIONS CONSOLE SHIPPED**

Accountants and administrators can now assess repository-wide ledger health,
review scan history, trigger manual scans, and drill into per-dealer
reconciliation — without touching the database.

---

## 1. Architectural Boundary

```
FinancialIntegrityScan (persisted)
        ↓
Integrity Console UI (presentation only)
        ↓
Management visibility

reconcileAllDealers() → dealer drill-down (read-only, on page load)
runFinancialIntegrityScan() → manual scan button
```

| Rule | Enforcement |
|------|-------------|
| Presentation only | React components display server DTOs |
| Scan cards | `FinancialIntegrityScan` fields only |
| Dealer table | `getReconciliationSummary()` DTO only |
| Overall status | GREEN when drift/missing/corrupted = 0; else YELLOW |
| No mutation | UI never writes ledger or balances |

---

## 2. Route

Production route: `/ledger/integrity`

Replaces PHASE_07E4 dev tooling page. Financial administration RBAC
(`invoices:create`) at page and scan action layer.

---

## 3. Module Layout

```
src/components/ledger/integrity/
├── integrity-console-view.tsx
├── integrity-console-header.tsx
├── integrity-summary-cards.tsx
├── integrity-scan-controls.tsx
├── integrity-scan-history-table.tsx
├── integrity-dealer-filters.tsx
├── integrity-dealer-table.tsx
├── integrity-console-empty-state.tsx
├── integrity-overall-status-badge.tsx
├── integrity-dealer-status-badge.tsx
├── integrity-console-utils.ts
├── integrity-console.test.ts
└── index.ts

src/app/(dashboard)/ledger/integrity/page.tsx
```

Consumes existing server actions only — no new backend contracts.

---

## 4. Filters

Client-side status and search filters on dealer drill-down. Date filters are
rendered but disabled (future-ready) — backend contracts unchanged.

---

## 5. Testing

11 presentation tests cover: empty state, healthy/drifted/missing/corrupted
status derivation, duration formatting, history rows, date filter, dealer
status/search filtering.

---

## Decision

Accept the Integrity Console as the production operations surface for
PHASE_07E3/E4 capabilities. Future phases may add cron wiring,
notifications, and repair workflows without redesigning this console.
