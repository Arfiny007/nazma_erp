# NEXT ACTION

## Current State

PHASE_07E3_ENTERPRISE_RECONCILIATION_ENGINE is **complete** (2026-07-10):

- `reconcileDealer()` / `reconcileAllDealers()` — read-only integrity verification
- Rules A/B/C — cache parity, sum parity, chain integrity
- Status: `CONSISTENT`, `DRIFT`, `MISSING_LEDGER`, `CORRUPTED_CHAIN`
- Dev page `/ledger/reconciliation` with summary cards + dealer table
- 10 new unit tests; ADR-034 authored
- Full suite: **211 passed / 7 skipped**

PHASE_07E1 discovery, PHASE_07E2 replay, and prior phases remain complete.

**Not yet built:** Reconciliation dashboard, scheduled cron job, repair tools,
Excel/email statement export, due reports.

---

## Next Steps

### 1. Statement Excel / Email Export (presentation follow-on)

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
