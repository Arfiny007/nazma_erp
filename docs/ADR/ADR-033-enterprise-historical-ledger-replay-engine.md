# ADR-033: Enterprise Historical Ledger Replay Engine — PHASE_07E2

Date: 2026-07-10

Status: ACCEPTED

Phase: PHASE_07E2_HISTORICAL_REPLAY_ENGINE

Builds on: ADR-025, ADR-026, ADR-027, ADR-032

---

## Context

PHASE_07E1 shipped read-only discovery (`getLedgerBackfillCandidates()`).
Dealers with financial activity before PHASE_07B may have `Invoice` and
`Collection` documents (and a correct `Dealer.currentBalance` cache) but
missing `LedgerEntry` rows.

PHASE_07E2 adds the **Historical Replay Engine** — idempotent reconstruction
of missing ledger rows from financial documents. No dashboards, cron jobs,
exports, or balance mutation.

**Explicitly out of scope:** `posting-service.ts` changes, invoice/collection
engine changes, opening balance engine changes, statement engine changes,
document platform changes, Prisma schema changes, scheduled reconciliation
(PHASE_07E3).

---

## Executive Summary

**Verdict: HISTORICAL REPLAY ENGINE SHIPPED**

Eligible dealers (`NO_LEDGER`, `PARTIAL_LEDGER`) can now replay missing
`LedgerEntry` rows transactionally via `replayDealerLedger()`. Replay uses
`createLedgerEntry()` and `buildLedgerPostingKey()` — never duplicates
posting logic. Parity is verified after replay; mismatch rolls back.

---

## 1. Architectural Boundary

```
PHASE_07E1 Discovery (getLedgerBackfillCandidates)
        ↓
replayDealerLedger() / executeLedgerBackfill()
        ↓
gatherReplayEvents() — chronological document read
        ↓
createLedgerEntry() — idempotent via postingKey
        ↓
assertLedgerBalanceMatchesCache() — parity gate
        ↓
LedgerEntry (append-only)
```

| Rule | Enforcement |
|------|-------------|
| No balance mutation | Replay never calls `posting-service.ts` or `dealer.update` |
| Sole write path | `createLedgerEntry()` only |
| Idempotency | `postingKey @unique` — safe to run twice |
| Parity | `LedgerEntry.balance == Dealer.currentBalance` after replay |
| Discovery reuse | Eligibility consumes PHASE_07E1 classification |
| Rollback | Parity failure rolls back entire transaction |

---

## 2. Module Layout

```
src/lib/ledger/backfill/
├── ledger-backfill-replay-query.ts   # document gather + sort
├── ledger-backfill-replay.ts         # replayDealerLedger()
├── ledger-backfill-service.ts        # executeLedgerBackfill()
├── ledger-backfill-report.ts         # buildReplayReport()
├── ledger-backfill.test.ts           # 15 replay tests
└── index.ts                          # extended exports

src/lib/actions/ledger-backfill/
├── execute-ledger-backfill.ts
├── preview-ledger-replay.ts
└── get-replay-status.ts

src/app/(dashboard)/ledger/backfill/
└── ledger-backfill-replay-controls.tsx
```

---

## 3. Replay Order

Strict phase ordering:

1. Opening Balance (Posted/Locked, non-zero)
2. Issued invoices (`Issued`, `Paid`, `Partial`, `Overdue`)
3. Confirmed collections (`Confirmed`, `PartiallyAllocated`, `Allocated`)
4. Collection reversals (`Reversed` — Collection entry + Reversal entry)

Within each phase: `transactionDate` → `postingDate` → `createdAt`.

---

## 4. Eligibility

| Status | Replay |
|--------|--------|
| `NO_LEDGER` | Allowed |
| `PARTIAL_LEDGER` | Allowed |
| `RECONCILED` | Idempotent no-op (0 created) |
| `CACHE_DRIFT` | Rejected unless pending events project to cache parity |
| Corrupted chain | Rejected |
| Invalid history | Rejected |

---

## 5. RBAC

Server actions require `ledger:view` AND `invoices:create` (financial
administration). No `permissions.ts` change.

---

## 6. Testing

15 unit tests cover: invoices only, collections only, opening balance,
reversals, duplicate replay, partial replay, chronological order,
reconciled idempotent no-op, cache drift rejection, parity rollback,
corrupted chain rejection, `createLedgerEntry` idempotency.

---

## Decision

Accept historical ledger replay as the mandatory PHASE_07E2 mutation path.
**PHASE_07E3 (Scheduled Reconciliation Job) is NEXT.**
