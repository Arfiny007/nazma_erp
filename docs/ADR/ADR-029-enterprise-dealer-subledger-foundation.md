# ADR-029: Enterprise Dealer Subledger Foundation — PHASE_07D1

Date: 2026-07-09

Status: ACCEPTED

Phase: PHASE_07D1_ENTERPRISE_DEALER_SUBLEDGER_FOUNDATION

Builds on: ADR-024, ADR-025, ADR-026, ADR-027, ADR-028

---

## Context

PHASE_07A–07C delivered the append-only `LedgerEntry` subledger, wired it
into `posting-service.ts`, certified financial integrity (ADR-027), and
shipped the Financial Initialization Engine with Opening Balance (ADR-028).

Every dealer receivable mutation now produces immutable journal rows whose
`balance` field is asserted equal to `Dealer.currentBalance` on every
commit. The ERP is ready for **read-side consumption** of that subledger.

ADR-024 §12 and ADR-028 both approved PHASE_07D as the next phase: a Dealer
Subledger & Statement Engine. This ADR records **PHASE_07D1 only** — the
read-only foundation that every future statement consumer must share.

**Explicitly out of scope for PHASE_07D1:** PDF, Excel, email statements,
reports, dashboards, printing, reconciliation jobs, production statement UI,
and any mutation of `LedgerEntry`, `Dealer`, `Invoice`, `Collection`, or
`OpeningBalance`.

---

## Executive Summary

**Verdict: DEALER SUBLEDGER READ FOUNDATION SHIPPED**

The ERP now has a single, reusable, read-only Dealer Statement engine at
`src/lib/ledger/statement/`. `getDealerStatement()` and
`getDealerStatementSummary()` project paginated statement rows directly from
`LedgerEntry` — running balances are copied verbatim from
`LedgerEntry.balance` and are **never recomputed**. Server actions expose
transport-safe DTOs; a lightweight `/ledger/demo` page verifies the pipeline
without building production UI.

---

## 1. Architectural Goal

```
LedgerEntry (Tier 1 — authoritative)
        ↓
Dealer Statement Service  (read only)
        ↓
Statement DTO
        ↓
UI / PDF / Excel / Email / Reports  (future phases)
```

The statement engine is the **single source** for:

- Dealer Statement
- Customer Ledger
- Ledger Preview
- Printable Statement (future)
- PDF / Excel / Email Statements (future)

All consumers call the same read service — no duplicate query logic.

---

## 2. Read Boundary

| Rule | Enforcement |
|------|-------------|
| Never mutate financial data | No `create` / `update` / `delete` in `statement-query.ts` |
| Never call posting functions | No import of `posting-service.ts` or `createLedgerEntry` |
| Never calculate truth from invoices | `Invoice` and `Collection` are not queried for row amounts |
| Running balance from ledger | `StatementRow.runningBalance = LedgerEntry.balance` verbatim |
| Opening balance is first row | When initialized, `postingType = OpeningBalance` is simply the first `LedgerEntry` chronologically — no special arithmetic |

Ledger integrity is **validated read-only** via `validateDealerLedgerChain()`
and exposed in `meta.ledgerIntegrity` — the statement still returns on
drift (graceful degradation for operators) rather than throwing.

---

## 3. Module Layout

```
src/lib/ledger/statement/
├── dealer-statement-service.ts   # getDealerStatement(), getDealerStatementSummary()
├── statement-query.ts            # Prisma read queries only
├── statement-mapper.ts           # LedgerEntry → StatementRow projection
├── statement-types.ts            # Domain types (Decimal-based)
├── statement-validation.ts       # Pure validation (dealer, dates, pagination)
├── statement-errors.ts           # Typed error hierarchy
└── index.ts                      # Public barrel

src/lib/actions/ledger-statement/
├── get-dealer-statement.ts
├── get-dealer-statement-summary.ts
├── helpers.ts
└── mappers.ts                    # Decimal → string DTO conversion

src/types/ledger-statement.ts     # Transport DTOs
src/lib/validators/ledger-statement.schema.ts
```

---

## 4. `getDealerStatement()` Contract

**Inputs:** `dealerCode`, optional `fromDate` / `toDate`, `page`, `pageSize`

**Returns:**

| Section | Source |
|---------|--------|
| `meta` | `Dealer`, `OpeningBalance`, `validateDealerLedgerChain()` |
| `openingBalanceForRange` | Last `LedgerEntry.balance` before `fromDate` (or zero) |
| `rows[]` | Paginated `LedgerEntry` ordered by `(transactionDate, postingDate, id)` ASC |
| `totals` | Aggregated debit/credit/count across **entire** filtered range |
| `pagination` | Page metadata |

Each row exposes: Date, Posting Type, Reference Type, Reference Number,
Description, Debit, Credit, Running Balance (from ledger), Created By.

---

## 5. Data Sources

| Model | Usage |
|-------|-------|
| `LedgerEntry` | Authoritative row source — amounts and running balance |
| `Dealer` | Identity, `currentBalance` cache, `creditLimit` |
| `OpeningBalance` | Metadata only (`hasOpeningBalance`, amount, effective date) |
| `Invoice` | **Not queried** in PHASE_07D1 |
| `Collection` | **Not queried** in PHASE_07D1 |

Future hybrid enrichment (document line detail alongside ledger rows) plugs
into `statement-mapper.ts` without redesigning the query layer.

---

## 6. Server Actions

| Action | Permission | Behavior |
|--------|------------|----------|
| `getDealerStatement()` | `ledger:view` | Full paginated statement DTO |
| `getDealerStatementSummary()` | `ledger:view` | Compact totals + date bounds |

Both are read-only. RBAC reuses the existing `ledger:view` permission —
no `permissions.ts` change required.

---

## 7. Dev Verification UI

Route: `/ledger/demo`

Purpose: select dealer, choose date range, view statement rows. No styling
work, no print layout. Not a production statement page.

---

## 8. Testing Strategy

Unit tests against an in-memory Prisma stub (same technique as
`posting-service.test.ts`):

- Dealer with Opening Balance
- Dealer without Opening Balance
- Invoice (`Issue`) rows
- Collection rows
- Running balance verbatim from `LedgerEntry.balance`
- Date filtering + carry-forward opening for range
- Pagination
- Empty ledger / future dealer
- Totals across full range vs page
- Validation errors (dealer not found, invalid dates, invalid pagination)

---

## 9. Future Extension Points (PHASE_07D2+)

| Extension | Hook |
|-----------|------|
| Production Ledger UI | Consume `getDealerStatement()` server action |
| Printable / PDF statement | Document platform composer maps `DealerStatementDTO` |
| Excel export | Same DTO — no second query path |
| Email statements | Scheduled job calls read service, hands DTO to mailer |
| Hybrid document enrichment | Extend `statement-mapper.ts` to join Invoice/Collection detail |
| Due reports (PHASE_08) | Reuse totals + `currentBalance` from summary action |

---

## 10. Verification Evidence

- Read-only architecture — no writes in `src/lib/ledger/statement/*`
- No balance mutation — grep confirms no `dealer.update` / `ledgerEntry.create`
- No `LedgerEntry` creation — statement module never imports `ledger-service.ts`
- Running balance from `LedgerEntry.balance` — mapper copies field verbatim
- Opening Balance visible as first ledger row when initialized
- `npx tsc --noEmit` — 0 errors
- `npx eslint .` — 0 errors
- `npx vitest run` — all statement tests pass; no regression in prior suites

---

## 11. Consequences

**Positive:**

- One read path for all future statement surfaces — no redesign when PDF/Excel land
- Ledger remains Tier 1 authoritative source (ADR-024 preserved)
- Integrity snapshot on every full statement read aids operators pre-PHASE_07E backfill

**Neutral:**

- `/ledger` nav item still points to a placeholder until PHASE_07D2 production UI
- Hybrid invoice/collection line detail deferred — ledger rows alone are sufficient for PHASE_07D1

**Negative / Risks:**

- Pre-PHASE_07B dealers may have cache/ledger drift until PHASE_07E backfill —
  `meta.ledgerIntegrity.isConsistent` surfaces this without blocking reads

---

## Decision

Accept the PHASE_07D1 Dealer Subledger Foundation as specified. Proceed to
PHASE_07D2 (production Ledger UI + document platform statement composer)
and PHASE_07E (reconciliation + backfill) per roadmap.
