# ADR-032: Enterprise Ledger Backfill Discovery — PHASE_07E1

Date: 2026-07-10

Status: ACCEPTED

Phase: PHASE_07E1_HISTORICAL_LEDGER_DISCOVERY_ENGINE

Builds on: ADR-024, ADR-025, ADR-026, ADR-027, ADR-029

---

## Context

PHASE_07B wired `createLedgerEntry` into `posting-service.ts`. Dealers with
financial activity **before** that integration may have `Invoice` and
`Collection` documents (and a non-zero `Dealer.currentBalance` cache) but no
corresponding `LedgerEntry` rows.

PHASE_07E will reconcile and backfill historical data. Before any replay or
mutation runs, the ERP must answer a single question safely:

> Which dealers require historical ledger reconstruction?

This ADR records **PHASE_07E1 only** — a read-only discovery module. No
ledger creation, no replay, no scheduled jobs, no balance mutation.

**Explicitly out of scope:** `posting-service.ts` changes, invoice/collection
engine changes, opening balance engine changes, statement engine changes,
document platform changes, Prisma schema changes, reconciliation jobs,
backfill execution.

---

## Executive Summary

**Verdict: LEDGER BACKFILL DISCOVERY SHIPPED**

The ERP can now scan every dealer and classify backfill requirements via
`getLedgerBackfillCandidates()`. Classification is pure, testable, and
read-only. A dev verification page at `/ledger/backfill` exposes the scan
for operators and engineers.

---

## 1. Architectural Boundary

```
Dealer / Invoice / Collection / LedgerEntry / OpeningBalance
        ↓
ledger-backfill-query.ts        (read only)
        ↓
ledger-backfill-validation.ts   (pure classification)
        ↓
getLedgerBackfillCandidates()
        ↓
Server action + /ledger/backfill dev page
        ↓
PHASE_07E replay/backfill       (future — NOT this phase)
```

| Rule | Enforcement |
|------|-------------|
| Read only | No `create` / `update` / `delete` in `backfill/` |
| No posting | No import of `posting-service.ts` or `createLedgerEntry` |
| No replay | No invoice/collection replay helpers called |
| No cache mutation | `Dealer.currentBalance` never written |
| Discovery only | `requiresBackfill` is advisory — no side effects |

---

## 2. Module Layout

```
src/lib/ledger/backfill/
├── ledger-backfill-discovery.ts   # getLedgerBackfillCandidates()
├── ledger-backfill-query.ts       # batched Prisma reads
├── ledger-backfill-validation.ts  # Rule A / B / C classification
├── ledger-backfill-types.ts
├── ledger-backfill-errors.ts
├── ledger-backfill-discovery.test.ts
└── index.ts

src/lib/actions/ledger-backfill/
└── get-ledger-backfill-candidates.ts

src/app/(dashboard)/ledger/backfill/
├── page.tsx
└── ledger-backfill-table.tsx
```

---

## 3. Discovery Rules

### Rule A — `NO_LEDGER`

`Dealer.currentBalance ≠ 0` **and** `ledgerEntryCount = 0`.

Indicates pre-ledger cache activity with no subledger rows.

### Rule B — `PARTIAL_LEDGER`

Dealer has issued invoices and/or confirmed collections, but ledger rows are
missing:

- zero ledger rows with financial documents, **or**
- `ledgerEntryCount < invoiceCount + collectionCount`

Counts include only ledger-eligible documents:

- Invoices: `Issued`, `Paid`, `Partial`, `Overdue` (excludes `Draft`)
- Collections: `Confirmed`, `PartiallyAllocated`, `Allocated` (excludes
  `Draft`, `Reversed`)

### Rule C — `CACHE_DRIFT`

`ledgerEntryCount > 0` and last `LedgerEntry.balance ≠ Dealer.currentBalance`.

### Otherwise — `RECONCILED`

Dealer needs no historical reconstruction.

### Priority

1. `CACHE_DRIFT`
2. `NO_LEDGER`
3. `PARTIAL_LEDGER`
4. `RECONCILED`

---

## 4. Candidate DTO

```ts
type LedgerBackfillCandidate = {
  dealerCode: string;
  dealerName: string;
  currentBalance: string;       // Decimal(18,2) as string
  ledgerEntryCount: number;
  invoiceCount: number;
  collectionCount: number;
  openingBalanceExists: boolean; // Posted or Locked OpeningBalance
  requiresBackfill: boolean;
  reason: "NO_LEDGER" | "PARTIAL_LEDGER" | "CACHE_DRIFT" | "RECONCILED";
};
```

---

## 5. RBAC

Server action and `/ledger/backfill` reuse existing `ledger:view` permission.
No `permissions.ts` change.

---

## 6. Testing

Unit tests cover:

- empty database
- zero ledger / non-zero balance (`NO_LEDGER`)
- invoices only (`PARTIAL_LEDGER`)
- collections only (`PARTIAL_LEDGER`)
- partial ledger coverage (`PARTIAL_LEDGER`)
- fully reconciled dealer (`RECONCILED`)
- cache drift classification (`CACHE_DRIFT`)

---

## 7. Future Phase — PHASE_07E2+

PHASE_07E2 (not this ADR) will consume `getLedgerBackfillCandidates()` to
drive idempotent historical replay via `postingKey`. Discovery logic must
remain the single classification source — backfill must not re-implement
rules.

---

## Decision

Accept read-only ledger backfill discovery as the mandatory gate before any
PHASE_07E mutation work. **PHASE_07E2 (Historical Replay Engine) is NEXT.**
