# NEXT ACTION

## Current State

PHASE_07E5_FINANCIAL_INTEGRITY_OPERATIONS_CONSOLE is **complete** (2026-07-10):

- Production `/ledger/integrity` — Financial Integrity Console
- Header, summary cards, scan history, manual scan, dealer drill-down
- Consumes `FinancialIntegrityScan` + `getReconciliationSummary()` only
- 11 new presentation tests; ADR-036 authored
- Full suite: **233 passed / 7 skipped**

PHASE_07E4 monitor, PHASE_07E3 reconciliation, and prior phases remain complete.

**Not yet built:** Cron scheduling, notifications, repair tools,
Excel/email statement export, due reports.

---

## Next Steps

### 1. Integrity Notifications & Cron (follow-on)

- Wire background scheduler to `runFinancialIntegrityScan()`
- Alert when scan detects drift, missing ledger, or corruption

### 2. Statement Excel / Email Export (presentation follow-on)

- Excel export / email delivery — same `DealerStatementDTO`, no second query path

### 4. Bulk Opening Balance Import (architecture ready, UI not built)

- `postOpeningBalanceBatch()` already shipped (PHASE_07C, ADR-028 §7)

### 5. Reporting (PHASE_08)

- Due reports and aging
- Cash book, collection register
- Territory / area analytics

### 6. Final Production Hardening

- Collection concurrency integration tests
- Fix `it.skipIf` registration-time evaluation gap (TECH_DEBT C8)

### Explicitly Out of Scope (until respective phase)

- Chart of Accounts / full GL — PHASE_07F+
- Email/SMS document delivery

---

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super_Admin | admin@nazma.local | Admin123! |
| Accounts | (seed if needed) | — |

---

## Notes

- `Dealer.currentBalance` = AR cache — reconciled to `LedgerEntry.balance` on
  every new post; discovery flags pre-PHASE_07B drift safely
- Discovery is **read only** — never creates ledger rows or mutates balances
- All balance mutations continue through `posting-service.ts` only
- All ledger writes flow through `createLedgerEntry` — called ONLY from
  `posting-service.ts`
- Collection allocation does not post balance and does not post ledger
- Delivery Challan remains NON-FINANCIAL
- Ledger is APPEND-ONLY — use compensating reversals for corrections
