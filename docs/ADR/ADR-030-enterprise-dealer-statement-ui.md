# ADR-030: Enterprise Dealer Statement UI — PHASE_07D2

Date: 2026-07-09

Status: ACCEPTED

Phase: PHASE_07D2_ENTERPRISE_DEALER_STATEMENT_UI

Builds on: ADR-024, ADR-025, ADR-026, ADR-027, ADR-028, ADR-029

---

## Context

PHASE_07D1 (ADR-029) shipped the read-only Dealer Statement engine
(`getDealerStatement()` / `getDealerStatementSummary()`) with a lightweight
`/ledger/demo` verification page. The ERP still lacked a production-grade
accountant UI comparable to SAP Business One / NetSuite / Dynamics / Odoo
Enterprise dealer ledgers.

This ADR records **PHASE_07D2 only** — presentation-layer production UI that
consumes the PHASE_07D1 read engine exactly as provided.

**Explicitly out of scope:** PDF, Excel, email, printing, document platform
statement composer, reconciliation jobs, posting changes, `LedgerEntry`
mutations, Prisma schema, permissions matrix, Invoice/Collection/Opening
Balance engines.

---

## Executive Summary

**Verdict: PRODUCTION DEALER STATEMENT UI SHIPPED**

Route `/ledger` is now a dense enterprise Dealer Statement workspace.
Header, filters, summary cards, ledger table, pagination, skeletons, empty
states, and integrity badges all render server-sourced DTO fields. Running
balances and monetary totals are never recalculated in React. The obsolete
`/ledger/demo` page is removed.

---

## 1. Architectural Boundary

```
LedgerEntry
    ↓
Dealer Statement Service   (PHASE_07D1 — unchanged)
    ↓
Dealer Statement DTO
    ↓
Production UI              (PHASE_07D2 — this ADR)
```

| Rule | Enforcement |
|------|-------------|
| UI consumes service only | `getDealerStatement()` server action is the sole data path |
| No duplicated query logic | No Prisma / Invoice / Collection reads in UI components |
| No money calculations | `useFormatMoney` formats decimal strings only |
| Running balance untouched | Table renders `row.runningBalance` verbatim |
| Future filters without redesign | Posting type / reference type / search controls exist in UI; payload omits them until the read engine accepts them |

---

## 2. Module Layout

```
src/app/(dashboard)/ledger/
├── page.tsx                 # enforcePermission("ledger:view")
└── page-client.tsx          # PageContainer + DealerStatementView

src/components/ledger/
├── dealer-statement-view.tsx
├── dealer-statement-header.tsx
├── dealer-statement-filters.tsx
├── dealer-statement-summary-cards.tsx
├── dealer-statement-table.tsx
├── dealer-statement-empty-state.tsx
├── dealer-statement-skeleton.tsx
├── dealer-statement-alert.tsx
├── ledger-posting-type-badge.tsx
├── ledger-reference-type-badge.tsx
├── ledger-integrity-badge.tsx
├── statement-row-styles.ts   # accents, presets, payload builder
└── dealer-statement-ui.test.ts
```

Removed: `src/app/(dashboard)/ledger/demo/*` (obsolete after production UI).

---

## 3. Page Composition

| Region | Source |
|--------|--------|
| Header | `meta.dealerName`, `meta.dealerCode`, `meta.currentBalance`, date range, `meta.ledgerIntegrity` |
| Summary cards | `openingBalanceForRange`, `totals.*`, `meta.currentBalance` (closing), `totals.entryCount` |
| Filters | Dealer combobox, from/to dates, quick presets, future-ready posting/reference/search |
| Table | `rows[]` — Date, Posting Type, Reference No/Type, Description, Debit, Credit, Running Balance, Created By |
| Pagination | `pagination` from DTO — manual page controls |
| Integrity badge | Green when `isConsistent`; amber warning otherwise |

Row accents (Opening = blue, Collection = green, Reversal = amber) are
visual-only CSS classes.

---

## 4. Closing Balance Semantics

The DTO does not expose a dedicated `closingBalanceForRange` field. Summary
cards display `meta.currentBalance` as **Closing Balance** — the Tier-3 AR
cache asserted equal to the last ledger balance on every post (ADR-026 /
ADR-027). Opening for the filtered range remains `openingBalanceForRange`.
Per-row truth remains `runningBalance`. No arithmetic is performed in React.

---

## 5. Testing Strategy

Presentation helpers tested under Vitest (node env — no React Testing Library
in this repository):

- Row accent mapping
- Query payload construction (future filters excluded)
- Quick date presets
- Error key mapping (dealer / date / permission / backend)
- Empty / populated / long-statement / pagination / dealer-switch DTO contracts
- Summary card field sourcing from DTO only

Existing PHASE_07D1 statement engine tests remain the financial truth suite.

---

## 6. Future Extension Points

| Extension | Hook |
|-----------|------|
| Posting / reference / text filters | Extend `getDealerStatementSchema` + query; UI already collects values |
| Printable / PDF statement | Document platform composer maps `DealerStatementDTO` (later phase) |
| Excel / email export | Same DTO — toolbar actions only |
| Dedicated closing-for-range field | Add to statement service + DTO; card swaps field name |
| Hybrid document enrichment | Extend `statement-mapper.ts` (ADR-029 §9) |

---

## 7. Verification Evidence

- UI consumes `getDealerStatement()` only — no duplicated business logic
- No money calculations / running balance untouched
- Ledger integrity badge present
- Desktop-first dense ERP layout; tablet/mobile readable
- EN/BN localization for all user-facing strings
- `npx tsc --noEmit` — 0 errors
- `npx eslint` on new ledger UI files — 0 errors
- `npx vitest run` — presentation tests + statement engine tests pass
- `/ledger/demo` removed; nav `/ledger` resolves to production page

---

## 8. Decision

**APPROVED.** PHASE_07D2 production Dealer Statement UI is complete.
Document platform statement composer / print / PDF / Excel remain deferred
to a later phase. PHASE_07E (Reconciliation & Backfill) is the next financial
engineering priority.
