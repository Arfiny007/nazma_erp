# NEXT ACTION

## Current State

PHASE_07D1_ENTERPRISE_DEALER_SUBLEDGER_FOUNDATION is **complete**
(2026-07-09):

- Read-only Dealer Statement engine shipped at `src/lib/ledger/statement/`
- `getDealerStatement()` / `getDealerStatementSummary()` — single source for
  all future statement consumers (UI, PDF, Excel, Email, Reports)
- Running balance copied verbatim from `LedgerEntry.balance` — never
  recomputed; `LedgerEntry` is the sole authoritative row source
- Server actions at `src/lib/actions/ledger-statement/` with `ledger:view`
  RBAC and transport-safe DTOs
- Dev verification page at `/ledger/demo` (not production UI)
- 19 new unit tests; ADR-029 authored
- **PHASE_07D2 (Production Ledger UI + Statement Composer) APPROVED**

PHASE_07C and PHASE_07B.5 remain complete. Financial architecture
certification score: **9.1 / 10**.

**Not yet built:** Production Ledger UI, statement PDF/Excel, reconciliation
scheduled job, backfill of pre-PHASE_07B data, credit notes, due reports,
bulk opening balance import UI.

---

## Next Steps

Roadmap after PHASE_07D1:

### 1. PHASE_07D2 — Production Ledger UI (APPROVED)

- Ledger list / detail routes (`/ledger`)
- Dealer subledger statement UI consuming `getDealerStatement()`
- Document platform statement composer
- Print / PDF via existing document pipeline
- No duplicate query logic — same read service as PHASE_07D1

### 2. PHASE_07E — Reconciliation & Backfill

- Backfill script: replay invoices + collections → ledger entries for
  existing data (idempotent via `postingKey`)
- Scheduled reconciliation job using `reconcileDealerLedger`,
  `assertDealerLedgerReconciled`, `replayDealerLedgerBalance`
- Tighten `assertDealerLedgerReconciled` — remove PHASE_07A
  empty-ledger short-circuit once backfill is complete
- Optional DB-level immutability policy (TECH_DEBT C6)

### 3. Bulk Opening Balance Import (architecture ready, UI not built)

- `postOpeningBalanceBatch()` and `OpeningBalanceSource.CsvImport` /
  `ExcelImport` / `ErpMigration` already shipped (PHASE_07C, ADR-028 §7)
- Needs only a file parser + import UI; zero engine changes anticipated

### 4. Reporting (PHASE_08)

- Due reports and aging
- Cash book, collection register
- Territory / area analytics
- Sales reports from `InvoiceItem` snapshots

### 5. Analytics

- Management dashboard KPIs
- Dealer analytics (`totalSales`, targets)
- Fulfillment rate reporting

### 6. Final Production Hardening

- Collection concurrency integration tests
- Composite database indexes for reporting
- Deployment checklist (credential rotation, migration pipeline)
- Optional: credit note / invoice void workflow — plugs into
  `postCreditNote()` and `postInvoiceReversal()`
- Optional: DB-level `REVOKE UPDATE, DELETE` on `LedgerEntry`
- Fix `it.skipIf` registration-time evaluation gap in pre-existing
  integration test files (TECH_DEBT C8)

### Explicitly Out of Scope (until respective phase)

- Chart of Accounts / full GL (Trial Balance, P&L, Balance Sheet) — PHASE_07F+
- Email/SMS document delivery

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |
| Accounts | (seed if needed) | — |

---

## Notes

- `Dealer.currentBalance` = AR cache (positive: dealer owes; negative:
  advance/credit) — now provably reconciled to `LedgerEntry.balance` on
  every commit (`assertLedgerBalanceMatchesCache`)
- All balance mutations continue through `posting-service.ts` only
- All ledger writes flow through `createLedgerEntry` — called ONLY from
  `posting-service.ts`
- Dealer Statement reads flow through `getDealerStatement()` — called ONLY from
  server actions / future document mappers — never from posting code
- Collection allocation does not post balance and does not post ledger —
  cash + ledger posted on confirm only (by design)
- Delivery Challan remains NON-FINANCIAL — no balance touch, no ledger row
- Ledger is APPEND-ONLY — never update or delete a historical row; use
  `buildReversalPosting` for corrections
