# NEXT ACTION

## Current State

PHASE_07D2_ENTERPRISE_DEALER_STATEMENT_UI is **complete** (2026-07-09):

- Production Dealer Statement at `/ledger` — dense enterprise ERP layout
- Consumes `getDealerStatement()` only — no duplicated query or money math
- Header, filters, summary cards, ledger table, integrity badge, pagination
- Future-ready posting type / reference type / text search controls
- `/ledger/demo` removed (obsolete)
- 13 presentation tests; ADR-030 authored
- Full suite: **171 passed / 7 skipped**

PHASE_07D1 read engine, PHASE_07C Opening Balance, and PHASE_07B.5
certification remain complete. Financial architecture score: **9.1 / 10**.

**Not yet built:** Statement PDF/Excel/print composer, reconciliation
scheduled job, backfill of pre-PHASE_07B data, credit notes, due reports,
bulk opening balance import UI.

---

## Next Steps

Roadmap after PHASE_07D2:

### 1. PHASE_07E — Reconciliation & Backfill (NEXT)

- Backfill script: replay invoices + collections → ledger entries for
  existing data (idempotent via `postingKey`)
- Scheduled reconciliation job using `reconcileDealerLedger`,
  `assertDealerLedgerReconciled`, `replayDealerLedgerBalance`
- Tighten `assertDealerLedgerReconciled` — remove PHASE_07A
  empty-ledger short-circuit once backfill is complete
- Optional DB-level immutability policy (TECH_DEBT C6)

### 2. Statement Document Composer (presentation follow-on)

- Document platform printable / PDF statement from `DealerStatementDTO`
- Excel export / email delivery — same DTO, no second query path
- Wire future filters into `getDealerStatementSchema` when needed

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
- Production UI at `/ledger` is presentation-only (ADR-030)
- Collection allocation does not post balance and does not post ledger —
  cash + ledger posted on confirm only (by design)
- Delivery Challan remains NON-FINANCIAL — no balance touch, no ledger row
- Ledger is APPEND-ONLY — never update or delete a historical row; use
  `buildReversalPosting` for corrections
