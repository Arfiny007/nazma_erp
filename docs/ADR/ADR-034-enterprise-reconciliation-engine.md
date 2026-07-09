# ADR-034: Enterprise Reconciliation Engine — PHASE_07E3

Date: 2026-07-10

Status: ACCEPTED

Phase: PHASE_07E3_ENTERPRISE_RECONCILIATION_ENGINE

Builds on: ADR-025, ADR-026, ADR-027, ADR-032, ADR-033

---

## Context

PHASE_07E1 (Discovery) and PHASE_07E2 (Replay) address historical ledger
gaps. Production operations still require ongoing integrity verification:

> For every dealer, does the ledger subledger agree with the operational cache?

PHASE_07A–07B shipped low-level helpers in `ledger-reconciliation.ts`.
PHASE_07E3 adds the **Enterprise Reconciliation Engine** — a dedicated,
read-only module with structured reporting, server actions, and a dev
verification page.

**Explicitly out of scope:** dashboards, repair actions, exports,
notifications, cron scheduling, balance mutation, ledger creation.

---

## Executive Summary

**Verdict: ENTERPRISE RECONCILIATION ENGINE SHIPPED**

The ERP can now detect balance drift, missing ledger history, broken ledger
chains, and corrupted accounting state for every dealer — without modifying
any financial data.

---

## 1. Architectural Boundary

```
LedgerEntry + Dealer.currentBalance
        ↓
ledger-reconciliation-query.ts     (read only)
        ↓
ledger-reconciliation-validation.ts (pure classification)
        ↓
reconcileDealer() / reconcileAllDealers()
        ↓
Integrity Report (future dashboard consumes this)
```

| Rule | Enforcement |
|------|-------------|
| Read only | No `create` / `update` / `delete` |
| No repair | Never calls replay, posting-service, or backfill mutation |
| Detection only | Reports `CONSISTENT`, `DRIFT`, `MISSING_LEDGER`, `CORRUPTED_CHAIN` |

---

## 2. Verification Rules

### Rule A — Cache Parity

```text
latest LedgerEntry.balance == Dealer.currentBalance
```

### Rule B — Sum Parity

```text
SUM(debit) - SUM(credit) == latest LedgerEntry.balance
```

### Rule C — Chain Integrity

```text
balance[i] == balance[i-1] + debit[i] - credit[i]
```

### Status Classification

| Status | Condition |
|--------|-----------|
| `CONSISTENT` | All rules pass |
| `MISSING_LEDGER` | Zero ledger rows, non-zero cache |
| `CORRUPTED_CHAIN` | Rule B or Rule C fails |
| `DRIFT` | Chain valid, cache ≠ latest ledger balance |

---

## 3. Module Layout

```
src/lib/ledger/reconciliation/
├── ledger-reconciliation-service.ts
├── ledger-reconciliation-query.ts
├── ledger-reconciliation-validation.ts
├── ledger-reconciliation-types.ts
├── ledger-reconciliation-errors.ts
├── ledger-reconciliation-report.ts
├── ledger-reconciliation.test.ts
└── index.ts

src/lib/actions/ledger-reconciliation/
├── reconcile-dealer.ts
├── reconcile-all-dealers.ts
└── get-reconciliation-summary.ts

src/app/(dashboard)/ledger/reconciliation/
├── page.tsx
└── ledger-reconciliation-table.tsx
```

Reuses PHASE_07A helpers (`validateDealerLedgerChain`, `replayDealerLedgerBalance`,
`getLastLedgerEntryForDealer`) without modifying them.

---

## 4. RBAC

Server actions and `/ledger/reconciliation` require `ledger:view` only.
No `permissions.ts` change.

---

## 5. Testing

10 unit tests cover: consistent, drift, missing ledger, corrupted chain,
empty dealer, multiple dealers, sum mismatch, chain mismatch, full report,
dealer not found.

---

## Decision

Accept read-only enterprise reconciliation as the integrity detection layer
before future dashboard and scheduled job phases. **No repair tooling in this
phase.**
