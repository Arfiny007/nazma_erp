# NEXT ACTION

## Current State

PHASE_07B.5_ENTERPRISE_FINANCIAL_INTEGRITY_CERTIFICATION is **complete**
(2026-07-09):

- Chief ERP architecture audit of full financial path certified (ADR-027)
- Repository grep: no balance or ledger bypass; no ledger UPDATE/DELETE in app code
- `validateDealerLedgerChain`, `assertDealerLedgerIntegrity`, `reconcileAllDealers` shipped
- `assertDealerLedgerReconciled` tightened — empty ledger reconciled only when cache = 0
- 9 new reconciliation unit tests + 1 integration test (DB optional)
- **Opening Balance (PHASE_07C) APPROVED** — accounting engine production-safe

PHASE_07B remains complete. Financial architecture certification score: **9.1 / 10**.

**Not yet built:** Opening balance implementation, ledger UI + dealer statement,
reconciliation scheduled job, backfill of pre-PHASE_07B data, credit notes, due reports.

---

## Next Steps

Roadmap after PHASE_07B.5:

### 1. PHASE_07C — Opening Balance (APPROVED)

- `openDealerBalance()` server action + Zod validator
- `postOpeningBalance()` in `posting-service.ts` using
  `buildOpeningBalancePosting` from `@/lib/ledger`
- `FinancialReferenceType.OpeningBalance` handler
- Migration path for existing dealers with non-zero `currentBalance`
- Assert `previousBalance = 0.00` and `Dealer.currentBalance = 0.00`
  before posting the opening entry
- RBAC — Super_Admin / Manager only

### 2. PHASE_07D — Ledger UI

- Ledger list / detail routes (`/ledger`)
- Dealer subledger statement (hybrid: ledger balance + document lines)
- Document platform statement composer
- Print / PDF via existing document pipeline
- Read-only projections of `LedgerEntry` — no ledger writes from UI

### 3. PHASE_07E — Reconciliation & Backfill

- Backfill script: replay invoices + collections → ledger entries for
  existing data (idempotent via `postingKey`)
- Scheduled reconciliation job using `reconcileDealerLedger`,
  `assertDealerLedgerReconciled`, `replayDealerLedgerBalance`
- Tighten `assertDealerLedgerReconciled` — remove PHASE_07A
  empty-ledger short-circuit once backfill is complete
- Optional DB-level immutability policy (TECH_DEBT C6)

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
- Collection allocation does not post balance and does not post ledger —
  cash + ledger posted on confirm only (by design)
- Delivery Challan remains NON-FINANCIAL — no balance touch, no ledger row
- Ledger is APPEND-ONLY — never update or delete a historical row; use
  `buildReversalPosting` for corrections
