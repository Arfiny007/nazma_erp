# NEXT ACTION

## Current State

PHASE_07E2_HISTORICAL_REPLAY_ENGINE is **complete** (2026-07-10):

- `replayDealerLedger()` reconstructs missing `LedgerEntry` rows idempotently
- Uses `createLedgerEntry()` + `buildLedgerPostingKey()` — no posting duplication
- Server actions: `executeLedgerBackfill`, `previewLedgerReplay`, `getReplayStatus`
- Dev page `/ledger/backfill` extended with Replay / Preview / Status controls
- 15 new unit tests; ADR-033 authored
- Full suite: **201 passed / 7 skipped**

PHASE_07E1 discovery, PHASE_07D3 printable statement, and prior phases remain
complete. Financial architecture score: **9.1 / 10**.

**Not yet built:** Scheduled reconciliation job, Excel/email statement export,
credit notes, due reports, bulk opening balance import UI.

---

## Next Steps

Roadmap after PHASE_07E2:

### 1. PHASE_07E3 — Scheduled Reconciliation Job (NEXT)

- Cron/scheduled job using `reconcileAllDealers`, `assertDealerLedgerReconciled`
- Optional DB-level immutability policy (TECH_DEBT C6)

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
